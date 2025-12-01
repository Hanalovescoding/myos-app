import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AppTab, Memory, Task, ChatMessage, StructuredItem } from './types';
import TabNavigation from './components/TabNavigation';
import MemoryCard from './components/MemoryCard';
import { processInput, generatePlan, getAgentResponse, searchMemories } from './services/geminiService';
import { 
  Send, 
  Loader2, 
  Search, 
  Sparkles, 
  CheckCircle2, 
  Circle, 
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Folder,
  FolderOpen,
  Tag,
  Calendar as CalendarIcon,
  Plus,
  X,
  Settings,
  Trash2,
  Image as ImageIcon,
  Camera,
  Layers,
  Edit2,
  MoreVertical
} from 'lucide-react';

// Helper to format timestamp to YYYY.MM.DD
const formatDate = (ts: number) => {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

// Helper for calendar generation
const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

// Helper: Compress Image
const compressImage = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${base64}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1024; // Limit max width for performance
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      // Compress quality to 0.7
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      resolve(dataUrl.split(',')[1]); // Remove prefix
    };
    img.onerror = () => resolve(base64); // Fallback
  });
};

export const App: React.FC = () => {
  // --- Global State ---
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.TODAY);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  
  // --- Settings / Categories State ---
  const [availableCategories, setAvailableCategories] = useState<string[]>(["Travel", "Learning", "Inspiration", "Work", "Life"]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [managerSelectedCategory, setManagerSelectedCategory] = useState<string | null>(null);
  const [tempCategoryName, setTempCategoryName] = useState(""); 
  const [tempProjectName, setTempProjectName] = useState("");

  // --- Input View State ---
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  // Refs for scrolling sync in highlighter
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // --- Memory View State ---
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRootCategory, setSelectedRootCategory] = useState<string>('All');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  
  // Manual Project Creation State
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState('Travel');


  // --- Today View State ---
  const [coachChat, setCoachChat] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Calendar State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  // --- Witty Subtitles (Memoized to prevent flickering on re-render) ---
  const randomSubtitle = useMemo(() => {
    const subtitles = [
        "Feed your second brain. It's hungry. 🧠",
        "Your mental RAM is full. Offload here. 💾",
        "From chaos to clarity in one click. 🪄",
        "Don't let that genius idea vanish. Trap it! 🕸️",
        "Screenshots, scribbles, and random 3AM thoughts. 📥",
        "Garbage in, Structure out. ♻️"
    ];
    return subtitles[Math.floor(Math.random() * subtitles.length)];
  }, []);

  // --- Initial Mock Data ---
  useEffect(() => {
    // Simulate some initial data for "Today"
    if (tasks.length === 0) {
      setTasks([
        { id: '1', title: 'Day 1: Check flights', day: 1, status: 'pending' },
        { id: '2', title: 'Day 1: Pack luggage', day: 1, status: 'completed' },
      ]);
    }
    // Simulate some initial memory data for "Travel" structure
    if (memories.length === 0) {
        setMemories([
            {
                id: 'mock1',
                originalText: 'Mock',
                rootCategory: 'Travel',
                project: 'Korea Trip',
                subProject: 'Seoul',
                type: 'note',
                structuredContent: [
                    { title: 'Gyeongbokgung Palace', category: 'Sightseeing', description: 'Wear Hanbok for free entry.', location: 'Seoul', rating: 5, targetDate: '2025.10.15', status: 'pending' }
                ],
                tags: [],
                createdAt: Date.now()
            },
            {
                id: 'mock2',
                originalText: 'Mock',
                rootCategory: 'Learning',
                project: 'General',
                subProject: 'General',
                type: 'note',
                structuredContent: [
                    { title: 'Learn to rest', category: 'Health', description: 'Taking breaks is productive.', status: 'pending' }
                ],
                tags: [],
                createdAt: Date.now()
            }
        ])
    }
  }, []);

  useEffect(() => {
    if (showChat) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [coachChat, showChat]);

  // --- Helpers for Hierarchy ---
  // Calculates: { "Travel": ["Korea Trip", "Japan"], "Work": ["Reports"] }
  const getProjectHierarchy = () => {
      const hierarchy: Record<string, string[]> = {};
      
      // Initialize with known categories to ensure keys exist even if empty
      availableCategories.forEach(cat => hierarchy[cat] = []);

      memories.forEach(m => {
          if (m.rootCategory && m.project && m.project !== 'General') {
              // Ensure key exists (in case availableCategories was changed but memory remains)
              if (!hierarchy[m.rootCategory]) hierarchy[m.rootCategory] = [];
              
              if (!hierarchy[m.rootCategory].includes(m.project)) {
                  hierarchy[m.rootCategory].push(m.project);
              }
          }
      });
      return hierarchy;
  };

  // Helper to ensure Project Names are globally unique across ALL categories
  const isProjectNameGloballyUnique = (name: string) => {
      if (name === 'General') return true;
      const existingProjects = new Set(memories.map(m => m.project));
      return !existingProjects.has(name);
  };

  // --- Handlers ---

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setInputText(val);
      // Logic: if ends with '/', show suggestions
      if (val.trim().endsWith('/')) {
          setShowTagSuggestions(true);
      } else if (val.trim().endsWith(' ')) {
          setShowTagSuggestions(false);
      }
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace') {
        const textarea = e.currentTarget;
        const cursor = textarea.selectionStart;
        // Only strictly at cursor point (no range selection)
        if (cursor !== textarea.selectionEnd) return;

        const textBefore = inputText.slice(0, cursor);
        
        // 1. Get all valid tags (Categories + Projects)
        const existingProjects = Array.from(new Set(memories.map(m => m.project))).filter(Boolean);
        const allTags = [...availableCategories, ...existingProjects];
        
        // 2. Sort by length DESC so we match longest phrase first ("Korea Trip" before "Korea")
        allTags.sort((a, b) => b.length - a.length);

        // 3. Find if we are ending with a known tag
        let matchedTag = null;
        for (const tag of allTags) {
            // Check if textBefore ends with "/Tag" (case-sensitive usually, or insensitive if preferred)
            // We'll use case sensitive to match exact tags
            if (textBefore.endsWith(`/${tag}`)) {
                matchedTag = tag;
                break; // Found longest match
            }
        }

        if (matchedTag) {
            e.preventDefault();
            const tagLength = matchedTag.length + 1; // +1 for the '/'
            const newText = inputText.slice(0, cursor - tagLength) + inputText.slice(cursor);
            setInputText(newText);
            
            // Reset cursor after update
            const newCursorPos = cursor - tagLength;
            setTimeout(() => {
                if (inputRef.current) {
                    inputRef.current.setSelectionRange(newCursorPos, newCursorPos);
                }
            }, 0);
        } else {
            // Fallback for unknown tags (simple word without spaces)
            // This handles cases where user is typing a NEW tag that isn't in the list yet
            const match = textBefore.match(/(\/[^\s]+)$/);
            if (match) {
                 // Standard behavior is usually let user delete char by char for unknown tags
                 // But if you want atomic delete for *any* thing starting with /, uncomment below:
                 /*
                 e.preventDefault();
                 const fullTag = match[1];
                 const newText = inputText.slice(0, cursor - fullTag.length) + inputText.slice(cursor);
                 setInputText(newText);
                 setTimeout(() => {
                    if (inputRef.current) inputRef.current.setSelectionRange(cursor - fullTag.length, cursor - fullTag.length);
                 }, 0);
                 */
            }
        }
    }
  };

  const handleScroll = () => {
      if (inputRef.current && backdropRef.current) {
          backdropRef.current.scrollTop = inputRef.current.scrollTop;
      }
  };

  const handleTagSelection = (tag: string) => {
      // Replace the trailing "/" with "/Tag "
      setInputText(prev => {
          const trimmed = prev.trimEnd();
          if (trimmed.endsWith('/')) {
              return trimmed.slice(0, -1) + "/" + tag + " ";
          }
          return prev + " /" + tag + " ";
      });
      setShowTagSuggestions(false);
      // Refocus input
      if (inputRef.current) {
          inputRef.current.focus();
      }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64String = reader.result as string;
              // Compress the image before setting state to avoid performance lag
              const rawBase64 = base64String.split(',')[1];
              try {
                  const compressed = await compressImage(rawBase64);
                  setSelectedImage(compressed);
              } catch (e) {
                  // Fallback if canvas fails
                  setSelectedImage(rawBase64);
              }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleProcessInput = async () => {
    if (!inputText.trim() && !selectedImage) return;
    setIsProcessing(true);
    try {
      // Check if it's a "Goal" request (simple heuristic for this demo)
      const isGoal = inputText.toLowerCase().includes('want to') || inputText.toLowerCase().includes('plan to') || inputText.toLowerCase().includes('days');
      
      // BUILD HIERARCHY: Category -> Projects[]
      const hierarchy = getProjectHierarchy();

      if (isGoal && inputText.length < 100 && !inputText.includes('/') && !selectedImage) {
        // Treat as a planning request (Text Only)
        const plan = await generatePlan(inputText, "7 days"); // Default 7 days for demo
        const newTasks: Task[] = plan.tasks.map((t, idx) => ({
          id: Date.now().toString() + idx,
          title: `Day ${t.day}: ${t.title}`,
          day: t.day,
          status: 'pending'
        }));
        setTasks(prev => [...prev, ...newTasks]);
        setInputText('');
        setCurrentTab(AppTab.TODAY);
      } else {
        // Treat as standard input ingestion (Multimodal), PASSING HIERARCHY MAP
        const result = await processInput(inputText, hierarchy, selectedImage || undefined);
        
        // --- POST-PROCESSING VALIDATION ---
        // 1. Build a strict Project -> Category map from existing data
        const projectToCategoryMap: Record<string, string> = {};
        Object.entries(hierarchy).forEach(([cat, projs]) => {
            projs.forEach(p => projectToCategoryMap[p] = cat);
        });

        // 2. Validate the returned 'project'
        let finalProject = result.project;
        let finalCategory = result.rootCategory;

        if (finalProject === 'General') {
             // If AI says General, ensure category is valid
             if (!availableCategories.includes(finalCategory)) {
                 finalCategory = availableCategories[0];
             }
        } else if (!projectToCategoryMap[finalProject]) {
            // AI generated a project that doesn't exist (Hallucination)
            finalProject = 'General';
            // finalCategory stays as predicted or defaults to General if invalid
            if(!availableCategories.includes(finalCategory)) finalCategory = availableCategories[0];
        } else {
            // Project exists. FORCE the category to be correct.
            finalCategory = projectToCategoryMap[finalProject];
        }

        // Ensure new items have default status
        const initializedItems = result.items.map(item => ({
            ...item,
            status: 'pending' as const
        }));

        const newMemory: Memory = {
          id: Date.now().toString(),
          createdAt: Date.now(),
          originalText: inputText,
          rootCategory: finalCategory, // Use validated category
          project: finalProject,       // Use validated project
          subProject: result.subProject,
          type: result.type,
          tags: result.tags,
          structuredContent: initializedItems,
          attachedImage: selectedImage || undefined // Persist the image
        };
        setMemories(prev => [newMemory, ...prev]);
        setInputText('');
        setSelectedImage(null);
        // Auto-expand the project if not general
        if (finalProject !== 'General') setExpandedProjects(prev => new Set(prev).add(finalProject));
        setSelectedRootCategory(finalCategory);
        setCurrentTab(AppTab.MEMORY);
      }
    } catch (error) {
      alert("Failed to process input. Please try again.");
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTaskComplete = (id: string, isMemoryItem: boolean) => {
    if (isMemoryItem) {
        // ID format for memory items: `${mem.id}_${idx}`
        const [memId, idxStr] = id.split('_');
        const idx = parseInt(idxStr, 10);

        setMemories(prev => prev.map(mem => {
            if (mem.id === memId) {
                const newContent = [...mem.structuredContent];
                if (newContent[idx]) {
                    const currentStatus = newContent[idx].status || 'pending';
                    newContent[idx] = {
                        ...newContent[idx],
                        status: currentStatus === 'pending' ? 'completed' : 'pending'
                    };
                }
                return { ...mem, structuredContent: newContent };
            }
            return mem;
        }));
    } else {
        // Standard Plan Task
        setTasks(prev => prev.map(t => t.id === id ? { 
            ...t, 
            status: t.status === 'pending' ? 'completed' : 'pending' 
        } : t));
    }
  };

  const handleDeleteMemoryItem = (memoryId: string, itemIndex: number) => {
      setMemories(prevMemories => {
          // Deep copy to ensure state updates trigger correctly
          const updatedMemories = prevMemories.map(mem => {
              if (mem.id === memoryId) {
                  // Create a new structuredContent array removing the item
                  const newContent = mem.structuredContent.filter((_, idx) => idx !== itemIndex);
                  // Return new memory object
                  return { ...mem, structuredContent: newContent };
              }
              return mem;
          });
          
          // Filter out memories that have become empty, unless it's a Manual Project placeholder
          return updatedMemories.filter(mem => mem.structuredContent.length > 0 || mem.originalText === 'Manual Project Creation');
      });
  };

  const handleUpdateMemoryItem = (memoryId: string, itemIndex: number, updatedItem: StructuredItem) => {
      setMemories(prevMemories => {
          return prevMemories.map(mem => {
              if (mem.id === memoryId) {
                  const newContent = [...mem.structuredContent];
                  newContent[itemIndex] = updatedItem;
                  return { ...mem, structuredContent: newContent };
              }
              return mem;
          });
      });
  };
  
  // --- Category Management Handlers ---
  const handleAddCategory = () => {
      if(!tempCategoryName.trim()) return;
      if(availableCategories.includes(tempCategoryName.trim())) return;
      setAvailableCategories(prev => [...prev, tempCategoryName.trim()]);
      setTempCategoryName("");
  };

  const handleDeleteCategory = (cat: string) => {
      if(availableCategories.length <= 1) {
          alert("You must have at least one category.");
          return;
      }
      setAvailableCategories(prev => prev.filter(c => c !== cat));
      if(selectedRootCategory === cat) setSelectedRootCategory('All');
      if(managerSelectedCategory === cat) setManagerSelectedCategory(null);
  };

  const handleUpdateCategoryName = (oldName: string, newName: string) => {
      if(!newName.trim() || newName === oldName) return;
      setAvailableCategories(prev => prev.map(c => c === oldName ? newName : c));
      
      // Also update existing memories to reflect the new name (optional but good UX)
      setMemories(prev => prev.map(m => m.rootCategory === oldName ? { ...m, rootCategory: newName } : m));
  };
  
  // --- Project Management Handlers ---
  const handleAddProject = (targetCategory?: string) => {
    const cat = targetCategory || newProjectCategory;
    const name = targetCategory ? tempProjectName : newProjectName;
    const trimmedName = name.trim();
    
    if (!trimmedName) return;
    
    // Check Global Uniqueness (Allow General, though manually adding General isn't needed)
    if (!isProjectNameGloballyUnique(trimmedName)) {
        alert(`Project "${trimmedName}" already exists in another category. Project names must be unique.`);
        return;
    }
    
    // Create a new memory entry that acts as the container
    const newMem: Memory = {
        id: Date.now().toString(),
        createdAt: Date.now(),
        originalText: "Manual Project Creation",
        rootCategory: cat,
        project: trimmedName,
        subProject: "General",
        type: "note",
        tags: [],
        structuredContent: [{
            title: "Project Initialized",
            category: "System",
            description: "Start adding memories to this project.",
            targetDate: formatDate(Date.now()),
            status: 'pending'
        }]
    };
    
    setMemories(prev => [newMem, ...prev]);
    setExpandedProjects(prev => new Set(prev).add(trimmedName));
    
    if(!targetCategory) {
        // Closed the main modal
        setNewProjectName("");
        setShowAddProjectModal(false);
        setSelectedRootCategory(cat);
    } else {
        // Clear temp input in Manager
        setTempProjectName("");
    }
  };

  const handleDeleteProject = (projectName: string) => {
      // Immediate deletion without confirmation
      setMemories(prev => prev.filter(m => m.project !== projectName));
  };

  const handleUpdateProjectName = (oldName: string, newName: string) => {
      if (!newName.trim() || newName === oldName) return;
      if (!isProjectNameGloballyUnique(newName.trim())) {
          alert("Project name already exists.");
          return;
      }
      setMemories(prev => prev.map(m => m.project === oldName ? { ...m, project: newName.trim() } : m));
  };

  const handleSearch = async () => {
    if(!searchQuery.trim()) {
        setSearchResult(null);
        return;
    }
    setIsSearching(true);
    const userQuery = String(searchQuery); // explicit cast
    const jsonMemories = JSON.stringify(memories);
    try {
        const answer = await searchMemories(userQuery, jsonMemories);
        setSearchResult(answer);
    } catch (e) {
        setSearchResult("Error occurred during search.");
    } finally {
        setIsSearching(false);
    }
  }

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    
    const userText = String(chatInput);
    
    // 1. Add User Message
    setCoachChat(prev => [...prev, { role: 'user', text: userText, timestamp: Date.now() }]);
    setChatInput('');
    
    // 2. Add "Thinking..." Indicator
    setCoachChat(prev => [...prev, { role: 'model', text: "Thinking...", timestamp: Date.now() }]);
    
    try {
        // 3. Fetch Response (Passing Memories Context!)
        const memoriesContext = JSON.stringify(memories.map(m => ({
            category: m.rootCategory,
            project: m.project,
            subProject: m.subProject,
            items: m.structuredContent
        })));

        const reply = await getAgentResponse(userText, memoriesContext); 
        
        // 4. Replace "Thinking..." with actual response
        setCoachChat(prev => prev.map(msg => 
            (msg.role === 'model' && msg.text === "Thinking...") 
                ? { ...msg, text: reply, timestamp: Date.now() } 
                : msg
        ));
    } catch(e) {
        // On error, remove thinking bubble
        setCoachChat(prev => prev.filter(msg => msg.text !== "Thinking..."));
    }
  };

  const toggleFolder = (projectName: string) => {
    const newSet = new Set(expandedProjects);
    if (newSet.has(projectName)) {
        newSet.delete(projectName);
    } else {
        newSet.add(projectName);
    }
    setExpandedProjects(newSet);
  }

  // --- Render Helper for Highlighting ---
  const renderHighlightedText = (text: string) => {
      // 1. Get all valid tags (Categories + Projects)
      const existingProjects = Array.from(new Set(memories.map(m => m.project))).filter(p => p !== 'General');
      const allTags = [...availableCategories, ...existingProjects];
      
      // 2. Sort tags by length (DESC) to match longest known phrases first (e.g. "Korea Trip" before "Korea")
      allTags.sort((a, b) => b.length - a.length);

      // 3. Escape for Regex
      const escapedTags = allTags.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      
      // 4. Build Regex Pattern
      // Matches: "/" followed by ( Known Tag Option 1 | Known Tag Option 2 | ... | Fallback: non-whitespace )
      // We use a capturing group around the whole thing to include it in the split output
      const patternString = `(\/(?:${escapedTags.join('|')}|[^\\s]+))`; 
      const regex = new RegExp(patternString, 'g');

      const parts = text.split(regex);
      
      return parts.map((part, index) => {
          if (part.startsWith('/')) {
              // It matched our tag pattern
              return (
                  <span key={index} className="bg-indigo-50 text-indigo-600 border border-indigo-100 rounded-md px-1 py-0.5 font-medium box-decoration-clone">
                      {part}
                  </span>
              );
          }
          return <span key={index}>{part}</span>;
      });
  };

  // --- Views ---

  const renderInputView = () => {
      // Get unique projects and roots for suggestions
      const existingProjects = Array.from(new Set(memories.map(m => m.project))).filter(p => p !== 'General');
      // Use DYNAMIC Categories
      const suggestions = [...availableCategories, ...existingProjects];
      
      const funPlaceholders = [
          "Spill the tea 🍵... or just your grocery list.",
          "What's cooking in that big brain of yours? 🧠",
          "Paste that chaotic travel itinerary here ✈️",
          "Screenshot analysis? Text dump? We take it all.",
          "Got a brilliant idea at 3AM? Write it down.",
          "Don't let that thought escape! Catch it here.",
      ];
      // Use a consistent random index for demo (or just random every render is fine for fun)
      const placeholderText = funPlaceholders[Math.floor(Math.random() * funPlaceholders.length)];

      return (
        <div className="flex flex-col h-full p-6">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Input Stream</h1>
        <p className="text-slate-500 mb-6 text-sm">{randomSubtitle}</p>
        
        <div className="flex-1 relative">
            {/* Input Container */}
            <div className={`relative w-full h-64 border-2 rounded-2xl bg-white transition-all shadow-sm overflow-hidden flex flex-col ${selectedImage ? 'border-indigo-500' : 'border-slate-100 focus-within:border-indigo-500'}`}>
                
                {/* Image Preview Area */}
                {selectedImage && (
                    <div className="h-20 bg-slate-50 border-b border-slate-100 px-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden relative border border-slate-300">
                                <img src={`data:image/jpeg;base64,${selectedImage}`} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Image Attached</span>
                        </div>
                        <button 
                            onClick={() => setSelectedImage(null)}
                            className="p-1.5 bg-white text-slate-400 hover:text-red-500 rounded-full border border-slate-200 hover:border-red-200 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                )}

                <div className="relative flex-1">
                    {/* Backdrop (Highlighter) */}
                    <div 
                        ref={backdropRef}
                        className="absolute inset-0 p-4 text-lg font-sans whitespace-pre-wrap break-words pointer-events-none text-transparent overflow-hidden"
                        aria-hidden="true"
                    >
                        <div className="text-slate-700">
                            {renderHighlightedText(inputText + (inputText.endsWith('\n') ? '\n ' : ''))}
                        </div>
                    </div>

                    {/* Actual Input (Transparent Text) */}
                    <textarea
                        ref={inputRef}
                        className="absolute inset-0 w-full h-full p-4 bg-transparent border-none outline-none resize-none text-lg font-sans text-transparent caret-slate-800 z-10 placeholder:text-slate-300"
                        placeholder={placeholderText}
                        value={inputText}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        onScroll={handleScroll}
                        spellCheck="false"
                    />
                </div>
            </div>
            
            {/* Tag Suggestions Overlay */}
            {showTagSuggestions && (
                <div className="absolute bottom-16 left-4 right-4 bg-white border border-slate-200 shadow-xl rounded-xl p-2 z-20 animate-in fade-in slide-in-from-bottom-2">
                    <div className="text-xs font-bold text-slate-400 mb-2 px-2">Select a label:</div>
                    <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                        {suggestions.map((tag, idx) => (
                            <button 
                                key={idx}
                                onClick={() => handleTagSelection(tag)}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-sm font-medium flex items-center space-x-1 transition-colors"
                            >
                                <Tag className="w-3 h-3" />
                                <span>{tag}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Image Upload Button (Replaces Mic) */}
            <input 
                type="file" 
                ref={fileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
            />
            <button 
                onClick={() => fileInputRef.current?.click()}
                className={`absolute bottom-4 right-4 p-3 rounded-full transition-all z-20 shadow-sm border border-slate-200 ${selectedImage ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-500'}`}
                title="Upload Image"
            >
                <Camera className="w-5 h-5" />
            </button>
        </div>

        <div className="mt-6">
            <button
            onClick={handleProcessInput}
            disabled={isProcessing || (!inputText.trim() && !selectedImage)}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-indigo-200 transition-all"
            >
            {isProcessing ? (
                <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Processing...</span>
                </>
            ) : (
                <>
                <Sparkles className="w-5 h-5" />
                <span>Process Input</span>
                </>
            )}
            </button>
        </div>
        
        {/* Quick Hints */}
        {existingProjects.length === 0 ? (
            <div className="mt-4 text-center text-xs text-red-400 bg-red-50 p-2 rounded-lg border border-red-100">
                You have no projects yet. Go to <strong>Memory</strong> tab and click <strong>+</strong> to create one first.
            </div>
        ) : (
            <div className="mt-8 grid grid-cols-2 gap-3">
                <div 
                    onClick={() => setInputText(`Eat at Ichiran (Shinjuku) Dec 30 /${existingProjects[0] || 'Travel'}`)}
                    className="p-3 bg-white rounded-lg border border-slate-100 text-xs text-slate-500 cursor-pointer hover:border-indigo-300 transition-colors"
                >
                    Try: Add to {existingProjects[0] || 'Project'} (Dec 30)
                </div>
                <div 
                    onClick={() => setInputText("Use View instead of Div /Learning")}
                    className="p-3 bg-white rounded-lg border border-slate-100 text-xs text-slate-500 cursor-pointer hover:border-indigo-300 transition-colors"
                >
                    Try: Add Note
                </div>
            </div>
        )}
        </div>
      );
  };

  const renderTodayView = () => {
    // Calendar Logic
    const today = new Date();
    today.setHours(0,0,0,0);
    
    // Format selectedDate to match Memory TargetDate (YYYY.MM.DD)
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const selectedDayStr = String(selectedDate.getDate()).padStart(2, '0');
    const formattedSelectedDate = `${selectedYear}.${selectedMonth}.${selectedDayStr}`;

    // 1. Get Standard Plan Tasks (Day Relative)
    const diffTime = selectedDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    const planDayNumber = diffDays + 1; 
    const standardTasks = tasks.filter(t => t.day === planDayNumber);

    // 2. Get Memory Items that match this Date
    const memoryTasks: { id: string, title: string, status: 'pending' | 'completed', isMemory: true, tag: string }[] = [];
    
    memories.forEach(mem => {
        mem.structuredContent.forEach((item, idx) => {
            if (item.targetDate === formattedSelectedDate) {
                memoryTasks.push({
                    id: `${mem.id}_${idx}`, // Unique composite ID
                    title: item.title,
                    status: item.status || 'pending',
                    isMemory: true,
                    tag: mem.project === 'General' ? mem.rootCategory : mem.project
                });
            }
        });
    });

    // Unified List
    const allItems = [
        ...standardTasks.map(t => ({ ...t, isMemory: false, tag: 'Coach Plan' })),
        ...memoryTasks
    ];

    // Calendar Grid Generation
    const daysInMonth = getDaysInMonth(selectedYear, selectedDate.getMonth());
    const firstDay = getFirstDayOfMonth(selectedYear, selectedDate.getMonth());
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);

    // Generate Month Options for Dropdown (Jan 2025 - Dec 2026)
    const generateMonthOptions = () => {
        const options = [];
        const startYear = 2025;
        const endYear = 2026;
        for (let y = startYear; y <= endYear; y++) {
            for (let m = 0; m < 12; m++) {
                options.push(new Date(y, m, 1));
            }
        }
        return options;
    };
    const monthOptions = generateMonthOptions();

    return (
    <div className="flex flex-col h-full relative">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10 transition-all">
        {/* Calendar Header Toggle */}
        <div className="p-4 flex items-center justify-between relative">
            <div className="flex items-center space-x-2">
                {/* Custom Month/Year Dropdown */}
                <div className="relative z-50">
                    <button 
                        onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)}
                        className="flex items-center space-x-2 text-2xl font-bold text-slate-900 hover:text-indigo-700 transition-colors focus:outline-none"
                    >
                        <span>{selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                        <ChevronDown className={`w-6 h-6 text-indigo-500 transition-transform duration-300 ${isMonthPickerOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Custom Dropdown List */}
                    {isMonthPickerOpen && (
                        <>
                            {/* Backdrop to close on click outside */}
                            <div className="fixed inset-0 z-40" onClick={() => setIsMonthPickerOpen(false)}></div>
                            
                            <div className="absolute top-full left-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 max-h-80 overflow-y-auto z-50 no-scrollbar animate-in fade-in zoom-in-95 origin-top-left">
                                <div className="p-2 space-y-1">
                                    {monthOptions.map(d => {
                                        const isSelected = d.getMonth() === selectedDate.getMonth() && d.getFullYear() === selectedDate.getFullYear();
                                        return (
                                            <button
                                                key={d.toISOString()}
                                                onClick={() => {
                                                    // Set date to 1st of selected month
                                                    setSelectedDate(d);
                                                    setIsMonthPickerOpen(false);
                                                }}
                                                className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                                                    isSelected 
                                                        ? 'bg-indigo-50 text-indigo-700 font-bold' 
                                                        : 'text-slate-600 hover:bg-slate-50'
                                                }`}
                                            >
                                                {d.toLocaleString('default', { month: 'long', year: 'numeric' })}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
            
            <div className="flex items-center space-x-3">
                 <p className="text-slate-400 text-xs font-medium">
                    {selectedDate.toDateString() === today.toDateString() ? "Today" : ""}
                </p>
                <button 
                    onClick={() => setIsCalendarOpen(!isCalendarOpen)}
                    className="p-2 bg-slate-50 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                >
                    {isCalendarOpen ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <CalendarIcon className="w-5 h-5 text-slate-600" />}
                </button>
            </div>
        </div>

        {/* Expandable Calendar Grid */}
        <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isCalendarOpen ? 'max-h-80 border-b border-slate-100' : 'max-h-0'}`}>
            <div className="p-4 pt-0">
                <div className="grid grid-cols-7 gap-1 text-center mb-3">
                    {['S','M','T','W','T','F','S'].map(d => (
                        <div key={d} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-y-2 gap-x-1">
                    {blanks.map(x => <div key={`blank-${x}`} />)}
                    {daysArray.map(day => {
                        const dateObj = new Date(selectedYear, selectedDate.getMonth(), day);
                        const isToday = dateObj.toDateString() === today.toDateString();
                        const isSelected = dateObj.toDateString() === selectedDate.toDateString();
                        
                        return (
                            <button
                                key={day}
                                onClick={() => setSelectedDate(dateObj)}
                                className={`
                                    h-9 w-9 rounded-full text-sm flex items-center justify-center mx-auto transition-all font-medium
                                    ${isSelected ? 'bg-indigo-600 text-white shadow-md transform scale-105' : 'text-slate-700 hover:bg-slate-100'}
                                    ${isToday && !isSelected ? 'border-2 border-indigo-600 text-indigo-600' : ''}
                                `}
                            >
                                {day}
                            </button>
                        );
                    })}
                </div>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 pb-24 no-scrollbar">
        <div className="space-y-4">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between">
             <span>Focus for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
             <span className="text-indigo-500 font-bold">{allItems.filter(i => i.status === 'completed').length}/{allItems.length} Done</span>
          </h2>
          
          {allItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <CalendarIcon className="w-8 h-8 opacity-20" />
                </div>
                <p className="font-medium">No tasks scheduled.</p>
                <p className="text-xs mt-2 opacity-70">Add items with dates in the Input tab.</p>
            </div>
          ) : (
             allItems.map(task => (
                <div 
                  key={task.id} 
                  className={`group flex items-center p-4 rounded-xl border transition-all duration-300 ${task.status === 'completed' ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200 hover:border-indigo-200 shadow-sm hover:shadow-md'}`}
                >
                  <button 
                    onClick={() => handleTaskComplete(task.id, task.isMemory)} 
                    className="mr-4 transition-transform active:scale-90 focus:outline-none"
                  >
                    {task.status === 'completed' ? (
                      <CheckCircle2 className="w-6 h-6 text-green-500 fill-green-50" />
                    ) : (
                      <Circle className="w-6 h-6 text-slate-300 group-hover:text-indigo-500 transition-colors" />
                    )}
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1.5">
                        {task.isMemory && <Tag className="w-3 h-3 text-indigo-500" />}
                        <span className={`text-[10px] uppercase font-bold tracking-wider ${task.isMemory ? 'text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded' : 'text-slate-400'}`}>
                            {task.tag}
                        </span>
                    </div>
                    {/* Cleaned Title: Remove "Day X: " prefix */}
                    <h3 className={`font-medium text-base transition-colors ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>
                        {task.title.replace(/^Day \d+:\s*/, '')}
                    </h3>
                  </div>
                </div>
             ))
          )}
        </div>
      </div>
    </div>
    );
  };

  const renderMemoryView = () => {
    // 1. Extract Unique Root Categories (Use state now)
    const filteredMemories = selectedRootCategory === 'All' 
        ? memories 
        : memories.filter(m => (m.rootCategory || 'Inspiration') === selectedRootCategory);

    // 2. Group by Project -> SubProject
    const groupedData: Record<string, Record<string, Memory[]>> = {};

    filteredMemories.forEach(memory => {
        const proj = memory.project || 'General'; // Default to General if strictly missing
        const sub = memory.subProject || 'General';
        
        if (!groupedData[proj]) groupedData[proj] = {};
        if (!groupedData[proj][sub]) groupedData[proj][sub] = [];
        
        groupedData[proj][sub].push(memory);
    });
    
    // Get hierarchy for display logic
    const hierarchy = getProjectHierarchy();

    return (
        <div className="flex flex-col h-full bg-slate-50 relative">
          <div className="p-6 bg-white sticky top-0 z-10 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <h1 className="text-2xl font-bold text-slate-800">Memory Bank</h1>
                <div className="flex space-x-2">
                    <button 
                        onClick={() => { setShowCategoryManager(true); setManagerSelectedCategory(null); }}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-xs transition-colors"
                        title="Structure Manager"
                    >
                        <Settings className="w-4 h-4" />
                        <span>Structure</span>
                    </button>
                </div>
            </div>
            
            {/* Search Bar */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                <input 
                    type="text" 
                    placeholder="Search memories..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="w-full pl-10 pr-4 py-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
                {isSearching && <Loader2 className="absolute right-3 top-3 w-5 h-5 text-indigo-600 animate-spin" />}
            </div>

            {/* Root Category Filters (Tabs) & Add Button */}
            <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1 items-center">
                <button 
                    onClick={() => setShowAddProjectModal(true)}
                    className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-indigo-50 text-indigo-600 transition-colors border border-transparent hover:border-indigo-200 flex-shrink-0"
                    title="Add New Project"
                >
                    <Plus className="w-4 h-4" />
                </button>
                <div className="h-5 w-px bg-slate-200 mx-1 flex-shrink-0"></div>
                <button 
                    onClick={() => setSelectedRootCategory('All')}
                    className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${selectedRootCategory === 'All' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}
                >
                    All
                </button>
                {availableCategories.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setSelectedRootCategory(cat)}
                        className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors flex-shrink-0 ${selectedRootCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}
                    >
                        {cat}
                    </button>
                ))}
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6 pb-24 no-scrollbar">
            {searchResult && (
                <div className="mb-8 bg-indigo-50 p-4 rounded-xl border border-indigo-100 animate-in fade-in">
                    <div className="flex items-center space-x-2 mb-2 text-indigo-700 font-bold text-sm">
                        <Sparkles className="w-4 h-4" />
                        <span>AI Answer</span>
                    </div>
                    <p className="text-slate-700 text-sm leading-relaxed whitespace-pre-wrap">{searchResult}</p>
                    <button onClick={() => setSearchResult(null)} className="mt-2 text-xs text-indigo-500 underline">Clear search</button>
                </div>
            )}
    
            {Object.keys(groupedData).length === 0 ? (
                <div className="text-center py-20 opacity-50">
                    <p>No memories found in this category.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    {/* 1. Render General (Direct) Items First */}
                    {groupedData['General'] && (
                        <div className="mb-6 space-y-3">
                             {/* Flatten General items */}
                             {Object.values(groupedData['General']).map(mems => 
                                mems.flatMap((m, i) => m.structuredContent.map((item, idx) => (
                                    <MemoryCard 
                                        key={`gen-${m.id}-${idx}`} 
                                        item={item} 
                                        displayDate={item.targetDate || formatDate(m.createdAt)} 
                                        attachedImage={m.attachedImage} 
                                        onDelete={() => handleDeleteMemoryItem(m.id, idx)} 
                                        onUpdate={(u) => handleUpdateMemoryItem(m.id, idx, u)} 
                                    />
                                )))
                             )}
                        </div>
                    )}
                    
                    {/* 2. Render Project Folders */}
                    {Object.keys(groupedData).filter(p => p !== 'General').map(projectName => {
                        const isExpanded = expandedProjects.has(projectName);
                        const subProjects = groupedData[projectName];

                        return (
                            <div key={projectName} className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm">
                                {/* Folder Header */}
                                <button 
                                    onClick={() => toggleFolder(projectName)}
                                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors"
                                >
                                    <div className="flex items-center space-x-3">
                                        {isExpanded ? (
                                            <FolderOpen className="w-6 h-6 text-indigo-500 fill-indigo-50" />
                                        ) : (
                                            <Folder className="w-6 h-6 text-slate-400 fill-slate-50" />
                                        )}
                                        <span className="font-bold text-slate-800">{projectName}</span>
                                        <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                                            {Object.values(subProjects).reduce((acc, curr) => acc + curr.length, 0)} items
                                        </span>
                                    </div>
                                    {isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                                </button>

                                {/* Folder Content */}
                                {isExpanded && (
                                    <div className="bg-slate-50 border-t border-slate-100 p-3 space-y-4">
                                        {Object.keys(subProjects).map(subProjectName => {
                                            // FLATTEN Items within SubProject for Sorting
                                            const rawMemories = subProjects[subProjectName];
                                            const flatItems: { item: StructuredItem, memoryId: string, idx: number, displayDate: string, attachedImage?: string }[] = [];
                                            
                                            rawMemories.forEach(mem => {
                                                mem.structuredContent.forEach((item, idx) => {
                                                    // Determine the definitive date string (YYYY.MM.DD)
                                                    const displayDate = item.targetDate || formatDate(mem.createdAt);
                                                    flatItems.push({
                                                        item,
                                                        memoryId: mem.id,
                                                        idx,
                                                        displayDate,
                                                        attachedImage: mem.attachedImage
                                                    });
                                                });
                                            });

                                            // Sort items by Date String (Ascending)
                                            flatItems.sort((a, b) => a.displayDate.localeCompare(b.displayDate));

                                            return (
                                            <div key={subProjectName}>
                                                {/* SubProject Header (only if not 'General' or if purely singular) */}
                                                {(subProjectName !== 'General' || Object.keys(subProjects).length > 1) && (
                                                     <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">
                                                        {subProjectName}
                                                     </h4>
                                                )}
                                                
                                                {/* Cards */}
                                                <div className="grid gap-3">
                                                    {flatItems.map(({ item, memoryId, idx, displayDate, attachedImage }) => (
                                                        <MemoryCard 
                                                            key={`${memoryId}-${idx}`} 
                                                            item={item} 
                                                            displayDate={displayDate}
                                                            attachedImage={attachedImage}
                                                            onDelete={() => handleDeleteMemoryItem(memoryId, idx)}
                                                            onUpdate={(updatedItem) => handleUpdateMemoryItem(memoryId, idx, updatedItem)}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )})}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
          </div>

          {/* New Project Modal */}
          {showAddProjectModal && (
            <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                <div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl scale-100 animate-in zoom-in-95">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-slate-800">Create New Project</h3>
                        <button onClick={() => setShowAddProjectModal(false)} className="text-slate-400 hover:text-slate-600">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                            <div className="flex flex-wrap gap-2 mb-2">
                                {availableCategories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setNewProjectCategory(cat)}
                                        className={`px-3 py-1 rounded-md text-xs font-medium border transition-colors ${
                                            newProjectCategory === cat 
                                            ? 'bg-indigo-50 border-indigo-200 text-indigo-700' 
                                            : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Project Name</label>
                            <input 
                                type="text"
                                value={newProjectName}
                                onChange={(e) => setNewProjectName(e.target.value)}
                                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-base font-medium"
                                placeholder="e.g. Europe Trip 2026"
                                autoFocus
                            />
                        </div>

                        <button 
                            onClick={() => handleAddProject()}
                            disabled={!newProjectName.trim()}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl shadow-lg shadow-indigo-200 transition-all mt-4"
                        >
                            Create Project
                        </button>
                    </div>
                </div>
            </div>
          )}
          
          {/* Structure Manager (New) */}
          {showCategoryManager && (
              <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
                  <div className="bg-white rounded-2xl w-full max-w-2xl h-[80vh] shadow-2xl flex overflow-hidden scale-100 animate-in zoom-in-95">
                      {/* Left: Category List */}
                      <div className="w-1/3 bg-slate-50 border-r border-slate-200 p-4 flex flex-col">
                          <h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Categories</h3>
                          <div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">
                             {availableCategories.map(cat => (
                                 <div 
                                    key={cat} 
                                    onClick={() => setManagerSelectedCategory(cat)}
                                    className={`p-3 rounded-lg cursor-pointer flex justify-between items-center group transition-colors ${managerSelectedCategory === cat ? 'bg-white shadow-sm border border-indigo-100 text-indigo-700' : 'hover:bg-slate-200 text-slate-600'}`}
                                 >
                                     <span className="font-medium text-sm truncate">{cat}</span>
                                     <div className="flex space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                         <button 
                                            onClick={(e) => { e.stopPropagation(); handleDeleteCategory(cat); }}
                                            className="p-1 hover:text-red-500"
                                         >
                                             <Trash2 className="w-3 h-3" />
                                         </button>
                                     </div>
                                 </div>
                             ))}
                          </div>
                          <div className="pt-4 border-t border-slate-200">
                             <input 
                                type="text" 
                                value={tempCategoryName}
                                onChange={(e) => setTempCategoryName(e.target.value)}
                                placeholder="New Category..."
                                className="w-full p-2 text-sm border border-slate-200 rounded-lg mb-2 focus:ring-1 focus:ring-indigo-500 outline-none"
                             />
                             <button 
                                onClick={handleAddCategory} 
                                disabled={!tempCategoryName.trim()}
                                className="w-full py-2 bg-slate-800 text-white text-xs font-bold rounded-lg disabled:opacity-50 hover:bg-slate-900 transition-colors"
                             >
                                 Add Category
                             </button>
                          </div>
                      </div>

                      {/* Right: Project List for Selected Category */}
                      <div className="w-2/3 p-6 flex flex-col bg-white">
                         <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold text-slate-800">{managerSelectedCategory || 'Select a Category'}</h3>
                            <button onClick={() => setShowCategoryManager(false)} className="p-2 hover:bg-slate-100 rounded-full">
                                <X className="w-5 h-5 text-slate-400" />
                            </button>
                         </div>
                         
                         {!managerSelectedCategory ? (
                             <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
                                 Select a category on the left to manage its projects.
                             </div>
                         ) : (
                             <>
                                <div className="flex-1 overflow-y-auto space-y-2 pr-2 no-scrollbar">
                                    {/* Default General Project */}
                                    <div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 text-sm font-medium flex items-center">
                                        <Layers className="w-4 h-4 mr-2" />
                                        General (Root Items)
                                    </div>

                                    {/* Project List */}
                                    {getProjectHierarchy()[managerSelectedCategory]?.map(proj => (
                                        <div key={proj} className="p-3 border border-slate-100 rounded-lg flex justify-between items-center group hover:border-indigo-100 hover:shadow-sm transition-all">
                                            <div className="flex items-center space-x-3">
                                                <Folder className="w-4 h-4 text-slate-400" />
                                                <input 
                                                    type="text" 
                                                    defaultValue={proj}
                                                    onBlur={(e) => handleUpdateProjectName(proj, e.target.value)}
                                                    className="text-sm font-medium text-slate-700 outline-none bg-transparent focus:text-indigo-600 focus:bg-slate-50 rounded px-1"
                                                />
                                            </div>
                                            <button 
                                                onClick={() => handleDeleteProject(proj)}
                                                className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-md opacity-0 group-hover:opacity-100 transition-all"
                                                title="Delete Project"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}

                                    {(!getProjectHierarchy()[managerSelectedCategory] || getProjectHierarchy()[managerSelectedCategory].length === 0) && (
                                        <div className="text-center py-8 text-slate-300 text-sm italic">
                                            No specific projects yet. Items can be added directly to General.
                                        </div>
                                    )}
                                </div>
                                
                                <div className="pt-6 border-t border-slate-100 mt-4">
                                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 block">
                                        Add Project to {managerSelectedCategory}
                                    </label>
                                    <div className="flex space-x-2">
                                        <input 
                                            type="text" 
                                            value={tempProjectName}
                                            onChange={(e) => setTempProjectName(e.target.value)}
                                            placeholder="Project Name..."
                                            className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none text-sm focus:ring-2 focus:ring-indigo-500"
                                        />
                                        <button 
                                            onClick={() => handleAddProject(managerSelectedCategory)} 
                                            disabled={!tempProjectName.trim()}
                                            className="px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-sm disabled:opacity-50 transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>
                                </div>
                             </>
                         )}
                      </div>
                  </div>
              </div>
          )}

        </div>
    );
  };

  return (
    <div className="max-w-md mx-auto bg-white h-screen shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* API Key Warning for Demo */}
        {!import.meta.env.VITE_GEMINI_API_KEY && (
             <div className="bg-red-500 text-white text-xs p-1 text-center font-bold">
                WARNING: API_KEY is missing in env. Features will fail.
             </div>
        )}

        <div className="flex-1 overflow-hidden relative">
            {currentTab === AppTab.INPUT && renderInputView()}
            {currentTab === AppTab.TODAY && renderTodayView()}
            {currentTab === AppTab.MEMORY && renderMemoryView()}
        </div>
        
        {/* Global Chat Button (Floating above nav on Today and Memory tabs) */}
        {currentTab !== AppTab.INPUT && (
             <button
                onClick={() => {
                    setShowChat(true);
                    if(coachChat.length === 0) {
                        setCoachChat([{ role: 'model', text: "Hello! I'm MyOS. I can help organize your memories into structured guides, itineraries, or lists. Ask me anything!", timestamp: Date.now() }]);
                    }
                }}
                className="absolute bottom-20 right-6 z-40 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105"
             >
                <MessageSquare className="w-6 h-6" />
             </button>
        )}

        {/* AI Coach Overlay / Modal - MOVED TO ROOT LEVEL */}
        {showChat && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in slide-in-from-bottom-5">
            <div className="p-4 border-b flex justify-between items-center bg-white shadow-sm">
                <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">AI</div>
                    <div>
                        <div className="font-bold text-slate-800">MyOS Agent</div>
                        <div className="text-xs text-green-500 flex items-center"><span className="w-1.5 h-1.5 bg-green-500 rounded-full mr-1"></span>Online</div>
                    </div>
                </div>
                <button 
                  onClick={() => setShowChat(false)} 
                  className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-medium transition-colors"
                >
                  Close
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {coachChat.map((msg, idx) => {
                    const isTyping = msg.text === "Thinking..." && msg.role === 'model';
                    return (
                        <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} mb-4`}>
                            <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm ${
                                msg.role === 'user' 
                                    ? 'bg-indigo-600 text-white rounded-br-none' 
                                    : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'
                            }`}>
                                {isTyping ? (
                                     <div className="flex space-x-1 h-4 items-center px-1">
                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></div>
                                    </div>
                                ) : (
                                    <div className="whitespace-pre-wrap leading-relaxed">
                                        {msg.text}
                                    </div>
                                )}
                            </div>
                            {!isTyping && (
                                <span className={`text-[10px] text-slate-400 mt-1 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>
            
            <div className="p-4 bg-white border-t border-slate-100 pb-8">
                 <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-100 transition-shadow">
                    <input 
                        type="text" 
                        placeholder="Ask about your plans..." 
                        className="flex-1 bg-transparent outline-none text-sm px-3 py-2 text-slate-800 placeholder:text-slate-400"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSendChatMessage();
                        }}
                    />
                    <button 
                      onClick={handleSendChatMessage}
                      disabled={!chatInput.trim()}
                      className="p-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 rounded-full text-white transition-colors shadow-md"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                 </div>
            </div>
        </div>
      )}

        <TabNavigation currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
};