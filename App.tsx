import React, { useState, useEffect, useRef, useMemo } from 'react';
import ReactMarkdown from 'react-markdown'; // ✅ 新增：引入 Markdown 渲染库
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

// --- Constants for Persistence ---
const STORAGE_KEYS = {
  MEMORIES: 'myos_memories',
  TASKS: 'myos_tasks',
  CATEGORIES: 'myos_categories',
};

// --- Helper Functions ---

const loadFromStorage = <T,>(key: string, defaultValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : defaultValue;
  } catch (e) {
    console.error(`Failed to load ${key}`, e);
    return defaultValue;
  }
};

const formatDate = (ts: number) => {
  const d = new Date(ts);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}.${month}.${day}`;
};

const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

const compressImage = (base64: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = `data:image/jpeg;base64,${base64}`;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 800; 
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
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
      resolve(dataUrl.split(',')[1]); 
    };
    img.onerror = () => {
        console.warn("Image compression failed, using original.");
        resolve(base64); 
    };
  });
};

const getCaretCoordinates = (element: HTMLTextAreaElement, position: number) => {
  const div = document.createElement('div');
  const style = window.getComputedStyle(element);
  Array.from(style).forEach(prop => div.style.setProperty(prop, style.getPropertyValue(prop)));
  div.style.position = 'absolute';
  div.style.visibility = 'hidden';
  div.style.whiteSpace = 'pre-wrap';
  div.style.top = '0';
  div.style.left = '0';
  div.textContent = element.value.substring(0, position);
  const span = document.createElement('span');
  span.textContent = element.value.substring(position) || '.';
  div.appendChild(span);
  document.body.appendChild(div);
  const coordinates = {
    top: span.offsetTop + parseInt(style.borderTopWidth),
    left: span.offsetLeft + parseInt(style.borderLeftWidth),
    height: parseInt(style.lineHeight)
  };
  document.body.removeChild(div);
  return coordinates;
}

export const App: React.FC = () => {
  // --- Global State ---
  const [currentTab, setCurrentTab] = useState<AppTab>(AppTab.TODAY);
  
  const [memories, setMemories] = useState<Memory[]>(() => loadFromStorage(STORAGE_KEYS.MEMORIES, []));
  const [tasks, setTasks] = useState<Task[]>(() => loadFromStorage(STORAGE_KEYS.TASKS, []));
  const [availableCategories, setAvailableCategories] = useState<string[]>(() => 
    loadFromStorage(STORAGE_KEYS.CATEGORIES, ["Travel", "Learning", "Inspiration", "Work", "Life"])
  );

  // --- Persistence ---
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.MEMORIES, JSON.stringify(memories)); }, [memories]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks)); }, [tasks]);
  useEffect(() => { localStorage.setItem(STORAGE_KEYS.CATEGORIES, JSON.stringify(availableCategories)); }, [availableCategories]);

  // --- UI State ---
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [managerSelectedCategory, setManagerSelectedCategory] = useState<string | null>(null);
  const [tempCategoryName, setTempCategoryName] = useState(""); 
  const [tempProjectName, setTempProjectName] = useState("");

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [showTagSuggestions, setShowTagSuggestions] = useState(false);
  const [suggestionPos, setSuggestionPos] = useState({ top: 0, left: 0 }); 
  const [tagSearchTerm, setTagSearchTerm] = useState(''); 
  const [activeTagIndex, setActiveTagIndex] = useState<number | null>(null); 
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isCompressingImage, setIsCompressingImage] = useState(false); 
  
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResult, setSearchResult] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedRootCategory, setSelectedRootCategory] = useState<string>('All');
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  
  const [showAddProjectModal, setShowAddProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectCategory, setNewProjectCategory] = useState('Travel');

  // --- Chat State ---
  const [coachChat, setCoachChat] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Calendar State
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

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

  useEffect(() => {
    if (showChat) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [coachChat, showChat]);

  // --- Logic ---
  const getProjectHierarchy = () => {
      const hierarchy: Record<string, string[]> = {};
      availableCategories.forEach(cat => hierarchy[cat] = []);
      memories.forEach(m => {
          if (m.rootCategory && m.project && m.project !== 'General') {
              if (!hierarchy[m.rootCategory]) hierarchy[m.rootCategory] = [];
              if (!hierarchy[m.rootCategory].includes(m.project)) hierarchy[m.rootCategory].push(m.project);
          }
      });
      return hierarchy;
  };

  const isProjectNameGloballyUnique = (name: string) => {
      if (name === 'General') return true;
      const existingProjects = new Set(memories.map(m => m.project));
      return !existingProjects.has(name);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const val = e.target.value;
      setInputText(val);
      const cursor = e.target.selectionStart;
      const textBefore = val.slice(0, cursor);
      const lastSlashIndex = textBefore.lastIndexOf('/');
      
      if (lastSlashIndex !== -1) {
          const textAfterSlash = textBefore.slice(lastSlashIndex + 1);
          if (!textAfterSlash.includes('\n') && textAfterSlash.length < 50) {
              setTagSearchTerm(textAfterSlash);
              setActiveTagIndex(lastSlashIndex);
              if (inputRef.current) {
                  const coords = getCaretCoordinates(inputRef.current, cursor);
                  setSuggestionPos({ top: coords.top + 24, left: coords.left });
              }
              setShowTagSuggestions(true);
              return;
          }
      }
      setShowTagSuggestions(false); setTagSearchTerm(''); setActiveTagIndex(null);
  };
  
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Backspace') {
        const textarea = e.currentTarget;
        const cursor = textarea.selectionStart;
        if (cursor !== textarea.selectionEnd) return;
        const textBefore = inputText.slice(0, cursor);
        const existingProjects = Array.from(new Set(memories.map(m => m.project))).filter(Boolean);
        const allTags = [...availableCategories, ...existingProjects];
        allTags.sort((a, b) => b.length - a.length);

        let matchedTag = null;
        for (const tag of allTags) {
            if (textBefore.endsWith(`/${tag}`)) { matchedTag = tag; break; }
        }
        if (matchedTag) {
            e.preventDefault();
            const tagLength = matchedTag.length + 1; 
            const newText = inputText.slice(0, cursor - tagLength) + inputText.slice(cursor);
            setInputText(newText);
            const newCursorPos = cursor - tagLength;
            setTimeout(() => { if (inputRef.current) inputRef.current.setSelectionRange(newCursorPos, newCursorPos); }, 0);
        }
    }
  };

  const handleScroll = () => {
      if (inputRef.current && backdropRef.current) { backdropRef.current.scrollTop = inputRef.current.scrollTop; }
      if (showTagSuggestions) setShowTagSuggestions(false);
  };

  const handleTagSelection = (tag: string) => {
      if (activeTagIndex === null) return;
      const beforeTag = inputText.slice(0, activeTagIndex);
      const afterTag = inputText.slice(activeTagIndex + 1 + tagSearchTerm.length);
      const newText = `${beforeTag}/${tag} ${afterTag}`;
      setInputText(newText);
      setShowTagSuggestions(false); setTagSearchTerm(''); setActiveTagIndex(null);
      setTimeout(() => {
          if(inputRef.current) {
              inputRef.current.focus();
              const newCursor = activeTagIndex + 1 + tag.length + 1; 
              inputRef.current.setSelectionRange(newCursor, newCursor);
          }
      }, 0);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
          const file = e.target.files[0];
          if (file.size > 10 * 1024 * 1024) { alert("Image too large (max 10MB)"); return; }
          setIsCompressingImage(true);
          const reader = new FileReader();
          reader.onloadend = async () => {
              const base64String = reader.result as string;
              const rawBase64 = base64String.split(',')[1];
              try {
                  const compressed = await compressImage(rawBase64);
                  setSelectedImage(compressed);
              } catch (e) { setSelectedImage(rawBase64); } 
              finally { setIsCompressingImage(false); }
          };
          reader.readAsDataURL(file);
      }
  };

  const handleProcessInput = async () => {
    if ((!inputText.trim() && !selectedImage) || isCompressingImage) return;
    setIsProcessing(true);
    try {
      const isGoal = inputText.toLowerCase().includes('want to') || inputText.toLowerCase().includes('plan to') || inputText.toLowerCase().includes('days');
      const hierarchy = getProjectHierarchy();

      if (isGoal && inputText.length < 100 && !inputText.includes('/') && !selectedImage) {
        const plan = await generatePlan(inputText, "7 days"); 
        const newTasks: Task[] = plan.tasks.map((t, idx) => ({
          id: Date.now().toString() + idx,
          title: `Day ${t.day}: ${t.title}`,
          day: t.day,
          status: 'pending'
        }));
        setTasks(prev => [...prev, ...newTasks]);
        setInputText(''); setCurrentTab(AppTab.TODAY);
      } else {
        const result = await processInput(inputText, hierarchy, selectedImage || undefined);
        const projectToCategoryMap: Record<string, string> = {};
        Object.entries(hierarchy).forEach(([cat, projs]) => { projs.forEach(p => projectToCategoryMap[p] = cat); });

        let finalProject = result.project;
        let finalCategory = result.rootCategory;
        if (finalProject === 'General') {
             if (!availableCategories.includes(finalCategory)) finalCategory = availableCategories[0];
        } else if (!projectToCategoryMap[finalProject]) {
            finalProject = 'General';
            if(!availableCategories.includes(finalCategory)) finalCategory = availableCategories[0];
        } else {
            finalCategory = projectToCategoryMap[finalProject];
        }

        const initializedItems = result.items.map(item => ({ ...item, status: 'pending' as const }));
        const newMemory: Memory = {
          id: Date.now().toString(), createdAt: Date.now(), originalText: inputText,
          rootCategory: finalCategory, project: finalProject, subProject: result.subProject,
          type: result.type, tags: result.tags, structuredContent: initializedItems, attachedImage: selectedImage || undefined
        };
        setMemories(prev => [newMemory, ...prev]);
        setInputText(''); setSelectedImage(null);
        if (finalProject !== 'General') setExpandedProjects(prev => new Set(prev).add(finalProject));
        setSelectedRootCategory(finalCategory); setCurrentTab(AppTab.MEMORY);
      }
    } catch (error) {
      console.error(error); 
      alert("Processing failed. Check API key or input size.");
    } finally { setIsProcessing(false); }
  };

  const handleTaskComplete = (id: string, isMemoryItem: boolean) => {
    if (isMemoryItem) {
        const [memId, idxStr] = id.split('_');
        const idx = parseInt(idxStr, 10);
        setMemories(prev => prev.map(mem => {
            if (mem.id === memId) {
                const newContent = [...mem.structuredContent];
                if (newContent[idx]) {
                    newContent[idx] = { ...newContent[idx], status: newContent[idx].status === 'pending' ? 'completed' : 'pending' };
                }
                return { ...mem, structuredContent: newContent };
            }
            return mem;
        }));
    } else {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, status: t.status === 'pending' ? 'completed' : 'pending' } : t));
    }
  };

  const handleDeleteMemoryItem = (memoryId: string, itemIndex: number) => {
      setMemories(prev => {
          const updated = prev.map(mem => {
              if (mem.id === memoryId) return { ...mem, structuredContent: mem.structuredContent.filter((_, idx) => idx !== itemIndex) };
              return mem;
          });
          return updated.filter(mem => mem.structuredContent.length > 0 || mem.originalText === 'Manual Project Creation');
      });
  };

  const handleUpdateMemoryItem = (memoryId: string, itemIndex: number, updatedItem: StructuredItem) => {
      setMemories(prev => prev.map(mem => {
          if (mem.id === memoryId) {
              const newContent = [...mem.structuredContent];
              newContent[itemIndex] = updatedItem;
              return { ...mem, structuredContent: newContent };
          }
          return mem;
      }));
  };
  
  const handleAddCategory = () => {
      if(!tempCategoryName.trim()) return;
      if(availableCategories.includes(tempCategoryName.trim())) return;
      setAvailableCategories(prev => [...prev, tempCategoryName.trim()]); setTempCategoryName("");
  };
  const handleDeleteCategory = (cat: string) => {
      if(availableCategories.length <= 1) { alert("Keep at least one category."); return; }
      setAvailableCategories(prev => prev.filter(c => c !== cat));
      if(selectedRootCategory === cat) setSelectedRootCategory('All');
      if(managerSelectedCategory === cat) setManagerSelectedCategory(null);
  };
  const handleUpdateCategoryName = (oldName: string, newName: string) => {
      if(!newName.trim() || newName === oldName) return;
      setAvailableCategories(prev => prev.map(c => c === oldName ? newName : c));
      setMemories(prev => prev.map(m => m.rootCategory === oldName ? { ...m, rootCategory: newName } : m));
  };
  const handleAddProject = (targetCategory?: string) => {
    const cat = targetCategory || newProjectCategory;
    const name = targetCategory ? tempProjectName : newProjectName;
    const trimmedName = name.trim();
    if (!trimmedName) return;
    if (!isProjectNameGloballyUnique(trimmedName)) { alert("Project exists."); return; }
    
    const newMem: Memory = {
        id: Date.now().toString(), createdAt: Date.now(), originalText: "Manual Project Creation",
        rootCategory: cat, project: trimmedName, subProject: "General", type: "note", tags: [],
        structuredContent: [{ title: "Project Initialized", category: "System", description: "Start adding memories.", targetDate: formatDate(Date.now()), status: 'pending' }]
    };
    setMemories(prev => [newMem, ...prev]); setExpandedProjects(prev => new Set(prev).add(trimmedName));
    if(!targetCategory) { setNewProjectName(""); setShowAddProjectModal(false); setSelectedRootCategory(cat); } else { setTempProjectName(""); }
  };
  const handleDeleteProject = (projectName: string) => setMemories(prev => prev.filter(m => m.project !== projectName));
  const handleUpdateProjectName = (oldName: string, newName: string) => {
      if (!newName.trim() || newName === oldName) return;
      if (!isProjectNameGloballyUnique(newName.trim())) { alert("Project exists."); return; }
      setMemories(prev => prev.map(m => m.project === oldName ? { ...m, project: newName.trim() } : m));
  };

  const handleSearch = async () => {
    if(!searchQuery.trim()) { setSearchResult(null); return; }
    setIsSearching(true);
    try {
        const answer = await searchMemories(searchQuery, JSON.stringify(memories));
        setSearchResult(answer);
    } catch (e) { setSearchResult("Error."); } finally { setIsSearching(false); }
  }

  const handleSendChatMessage = async () => {
    if (!chatInput.trim()) return;
    const userText = String(chatInput);
    setCoachChat(prev => [...prev, { role: 'user', text: userText, timestamp: Date.now() }]);
    setChatInput('');
    setCoachChat(prev => [...prev, { role: 'model', text: "Thinking...", timestamp: Date.now() }]);
    try {
        const memoriesContext = JSON.stringify(memories.map(m => ({ category: m.rootCategory, project: m.project, items: m.structuredContent })));
        const reply = await getAgentResponse(userText, memoriesContext); 
        setCoachChat(prev => prev.map(msg => (msg.role === 'model' && msg.text === "Thinking...") ? { ...msg, text: reply, timestamp: Date.now() } : msg));
    } catch(e) { setCoachChat(prev => prev.filter(msg => msg.text !== "Thinking...")); }
  };

  const toggleFolder = (projectName: string) => {
    const newSet = new Set(expandedProjects);
    if (newSet.has(projectName)) { newSet.delete(projectName); } else { newSet.add(projectName); }
    setExpandedProjects(newSet);
  }

  const renderHighlightedText = (text: string) => {
      const existingProjects = Array.from(new Set(memories.map(m => m.project))).filter(p => p !== 'General');
      const allTags = [...availableCategories, ...existingProjects];
      allTags.sort((a, b) => b.length - a.length);
      const escapedTags = allTags.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const patternString = `(\/(?:${escapedTags.join('|')}|[^\\s]+))`; 
      const regex = new RegExp(patternString, 'g');
      const parts = text.split(regex);
      return parts.map((part, index) => part.startsWith('/') ? <span key={index} className="bg-indigo-50 text-indigo-600">{part}</span> : <span key={index}>{part}</span>);
  };

  // --- Render Views ---
  const renderInputView = () => {
      const existingProjects = Array.from(new Set(memories.map(m => m.project))).filter(p => p !== 'General');
      const allTags = [...availableCategories, ...existingProjects];
      const filteredSuggestions = tagSearchTerm ? allTags.filter(t => t.toLowerCase().includes(tagSearchTerm.toLowerCase())) : allTags;
      return (
        <div className="flex flex-col h-full p-6 pb-24">
        <h1 className="text-2xl font-bold text-slate-800 mb-2">Input Stream</h1>
        <p className="text-slate-500 mb-6 text-sm">{randomSubtitle}</p>
        <div className="flex-1 relative">
            <div className={`relative w-full h-64 border-2 rounded-2xl bg-white transition-all shadow-sm overflow-hidden flex flex-col ${selectedImage ? 'border-indigo-500' : 'border-slate-100 focus-within:border-indigo-500'}`}>
                {selectedImage && (
                    <div className="h-20 bg-slate-50 border-b border-slate-100 px-4 flex items-center justify-between shrink-0">
                        <div className="flex items-center space-x-3">
                            <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden relative border border-slate-300">
                                <img src={`data:image/jpeg;base64,${selectedImage}`} alt="Preview" className="w-full h-full object-cover" />
                            </div>
                            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Image Attached</span>
                        </div>
                        <button onClick={() => setSelectedImage(null)} className="p-1.5 bg-white text-slate-400 hover:text-red-500 rounded-full border border-slate-200"><X className="w-4 h-4" /></button>
                    </div>
                )}
                <div className="relative flex-1 group">
                    <div ref={backdropRef} className="absolute inset-0 p-4 text-lg font-sans leading-relaxed tracking-normal whitespace-pre-wrap break-words pointer-events-none text-transparent overflow-hidden" aria-hidden="true">
                        <div className="text-slate-700">{renderHighlightedText(inputText + (inputText.endsWith('\n') ? '\n ' : ''))}</div>
                    </div>
                    <textarea ref={inputRef} style={{ fontFamily: 'inherit' }} className="absolute inset-0 w-full h-full p-4 bg-transparent border-none outline-none resize-none text-lg font-sans leading-relaxed tracking-normal text-transparent caret-slate-800 z-10 placeholder:text-slate-300" placeholder="Capture ideas..." value={inputText} onChange={handleInputChange} onKeyDown={handleKeyDown} onScroll={handleScroll} spellCheck="false" />
                </div>
            </div>
            {showTagSuggestions && filteredSuggestions.length > 0 && (
                <div ref={suggestionsRef} className="absolute z-50 bg-white/95 backdrop-blur-sm border border-slate-200 shadow-2xl rounded-xl p-2 animate-in fade-in zoom-in-95 w-72" style={{ top: Math.min(suggestionPos.top, 250), left: Math.min(suggestionPos.left, 150) }}>
                    <div className="text-xs font-bold text-slate-400 mb-2 px-2 uppercase tracking-wider">{tagSearchTerm ? 'Matching labels' : 'Suggestions'}</div>
                    <div className="flex flex-col gap-1 max-h-48 overflow-y-auto no-scrollbar">
                        {filteredSuggestions.map((tag, idx) => (
                            <button key={idx} onClick={() => handleTagSelection(tag)} className="px-3 py-2.5 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 rounded-lg text-sm font-medium flex items-center space-x-3 text-left transition-colors border border-transparent hover:border-indigo-100">
                                <Tag className="w-3.5 h-3.5 flex-shrink-0 opacity-70" /><span className="truncate">{tag}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
            <input type="file" ref={fileInputRef} accept="image/*" className="hidden" onChange={handleImageSelect} />
            <button onClick={() => fileInputRef.current?.click()} className={`absolute bottom-4 right-4 p-3 rounded-full transition-all z-20 shadow-sm border border-slate-200 ${selectedImage ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 hover:bg-slate-100 text-slate-500'} ${isCompressingImage ? 'opacity-50 cursor-wait' : ''}`} disabled={isCompressingImage}>
                {isCompressingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <Camera className="w-5 h-5" />}
            </button>
        </div>
        <div className="mt-6"><button onClick={handleProcessInput} disabled={isProcessing || (!inputText.trim() && !selectedImage) || isCompressingImage} className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold py-4 rounded-xl flex items-center justify-center space-x-2 shadow-lg shadow-indigo-200 transition-all">{isProcessing ? <><Loader2 className="w-5 h-5 animate-spin" /><span>Processing...</span></> : <><Sparkles className="w-5 h-5" /><span>Process Input</span></>}</button></div>
        </div>
      );
  };

  const renderTodayView = () => {
    const today = new Date(); today.setHours(0,0,0,0);
    const selectedYear = selectedDate.getFullYear();
    const selectedMonth = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const selectedDayStr = String(selectedDate.getDate()).padStart(2, '0');
    const formattedSelectedDate = `${selectedYear}.${selectedMonth}.${selectedDayStr}`;
    const diffTime = selectedDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); const planDayNumber = diffDays + 1; 
    const standardTasks = tasks.filter(t => t.day === planDayNumber);
    const memoryTasks = [];
    memories.forEach(mem => { mem.structuredContent.forEach((item, idx) => { if (item.targetDate === formattedSelectedDate) { memoryTasks.push({ id: `${mem.id}_${idx}`, title: item.title, status: item.status || 'pending', isMemory: true, tag: mem.project === 'General' ? mem.rootCategory : mem.project }); } }); });
    const allItems = [...standardTasks.map(t => ({ ...t, isMemory: false, tag: 'Coach Plan' })), ...memoryTasks];
    const daysInMonth = getDaysInMonth(selectedYear, selectedDate.getMonth());
    const firstDay = getFirstDayOfMonth(selectedYear, selectedDate.getMonth());
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: firstDay }, (_, i) => i);
    const monthOptions = []; for (let y = 2025; y <= 2026; y++) { for (let m = 0; m < 12; m++) monthOptions.push(new Date(y, m, 1)); }

    return (
    <div className="flex flex-col h-full relative">
      <div className="bg-white border-b border-slate-100 sticky top-0 z-10">
        <div className="p-4 flex items-center justify-between relative">
            <div className="flex items-center space-x-2"><div className="relative z-50"><button onClick={() => setIsMonthPickerOpen(!isMonthPickerOpen)} className="flex items-center space-x-2 text-2xl font-bold text-slate-900 hover:text-indigo-700 transition-colors focus:outline-none"><span>{selectedDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span><ChevronDown className={`w-6 h-6 text-indigo-500 transition-transform duration-300 ${isMonthPickerOpen ? 'rotate-180' : ''}`} /></button>{isMonthPickerOpen && (<><div className="fixed inset-0 z-40" onClick={() => setIsMonthPickerOpen(false)}></div><div className="absolute top-full left-0 mt-3 w-64 bg-white rounded-2xl shadow-xl border border-slate-100 max-h-80 overflow-y-auto z-50 no-scrollbar"><div className="p-2 space-y-1">{monthOptions.map(d => (<button key={d.toISOString()} onClick={() => { setSelectedDate(d); setIsMonthPickerOpen(false); }} className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium ${d.getFullYear()===selectedDate.getFullYear() && d.getMonth()===selectedDate.getMonth() ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-600 hover:bg-slate-50'}`}>{d.toLocaleString('default', { month: 'long', year: 'numeric' })}</button>))}</div></div></>)}</div></div>
            <div className="flex items-center space-x-3"><p className="text-slate-400 text-xs font-medium">{selectedDate.toDateString() === today.toDateString() ? "Today" : ""}</p><button onClick={() => setIsCalendarOpen(!isCalendarOpen)} className="p-2 bg-slate-50 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-colors">{isCalendarOpen ? <ChevronUp className="w-5 h-5 text-slate-600" /> : <CalendarIcon className="w-5 h-5 text-slate-600" />}</button></div>
        </div>
        <div className={`overflow-hidden transition-all duration-300 ${isCalendarOpen ? 'max-h-80 border-b border-slate-100' : 'max-h-0'}`}><div className="p-4 pt-0"><div className="grid grid-cols-7 gap-1 text-center mb-3">{['S','M','T','W','T','F','S'].map(d => <div key={d} className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{d}</div>)}</div><div className="grid grid-cols-7 gap-y-2 gap-x-1">{blanks.map(x => <div key={`blank-${x}`} />)}{daysArray.map(day => { const dateObj = new Date(selectedYear, selectedDate.getMonth(), day); const isSelected = dateObj.toDateString() === selectedDate.toDateString(); return (<button key={day} onClick={() => setSelectedDate(dateObj)} className={`h-9 w-9 rounded-full text-sm flex items-center justify-center mx-auto transition-all font-medium ${isSelected ? 'bg-indigo-600 text-white shadow-md transform scale-105' : 'text-slate-700 hover:bg-slate-100'}`}>{day}</button>); })}</div></div></div>
      </div>
      <div className="flex-1 overflow-y-auto p-6 pb-24 no-scrollbar">
        <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex justify-between"><span>Focus for {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span><span className="text-indigo-500 font-bold">{allItems.filter(i => i.status === 'completed').length}/{allItems.length} Done</span></h2>
        {allItems.length === 0 ? <div className="flex flex-col items-center justify-center py-20 text-slate-400"><div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4"><CalendarIcon className="w-8 h-8 opacity-20" /></div><p className="font-medium">No tasks scheduled.</p></div> : allItems.map(task => (
            <div key={task.id} className={`group flex items-center p-4 rounded-xl border transition-all duration-300 mt-4 ${task.status === 'completed' ? 'bg-slate-50 border-slate-100' : 'bg-white border-slate-200 hover:border-indigo-200 shadow-sm'}`}>
                <button onClick={() => handleTaskComplete(task.id, task.isMemory)} className="mr-4 transition-transform active:scale-90 focus:outline-none">{task.status === 'completed' ? <CheckCircle2 className="w-6 h-6 text-green-500 fill-green-50" /> : <Circle className="w-6 h-6 text-slate-300 group-hover:text-indigo-500" />}</button>
                <div className="flex-1"><div className="flex items-center space-x-2 mb-1.5">{task.isMemory && <Tag className="w-3 h-3 text-indigo-500" />}<span className={`text-[10px] uppercase font-bold tracking-wider ${task.isMemory ? 'text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded' : 'text-slate-400'}`}>{task.tag}</span></div><h3 className={`font-medium text-base transition-colors ${task.status === 'completed' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{task.title.replace(/^Day \d+:\s*/, '')}</h3></div>
            </div>
        ))}
      </div>
    </div>
    );
  };

  const renderMemoryView = () => {
      // (Simplified for brevity, logic unchanged from previous full version)
      // This part was already working fine in your original code
      // Just ensuring the structure matches exactly what you had
      const filteredMemories = selectedRootCategory === 'All' ? memories : memories.filter(m => (m.rootCategory || 'Inspiration') === selectedRootCategory);
      const groupedData: Record<string, Record<string, Memory[]>> = {};
      filteredMemories.forEach(memory => {
        const proj = memory.project || 'General'; const sub = memory.subProject || 'General';
        if (!groupedData[proj]) groupedData[proj] = {}; if (!groupedData[proj][sub]) groupedData[proj][sub] = [];
        groupedData[proj][sub].push(memory);
      });
      // ... Rest of render code matches your original ...
      // I am keeping the modal and list logic exactly as provided in your base code
      // to avoid breaking the UI
      return (
        <div className="flex flex-col h-full bg-slate-50 relative">
          {/* Header */}
          <div className="p-6 bg-white sticky top-0 z-10 shadow-sm">
            <div className="flex justify-between items-center mb-4"><h1 className="text-2xl font-bold text-slate-800">Memory Bank</h1><div className="flex space-x-2"><button onClick={() => { setShowCategoryManager(true); setManagerSelectedCategory(null); }} className="flex items-center space-x-1 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium text-xs transition-colors"><Settings className="w-4 h-4" /><span>Structure</span></button></div></div>
            <div className="relative mb-4"><Search className="absolute left-3 top-3 w-5 h-5 text-slate-400" /><input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSearch()} className="w-full pl-10 pr-4 py-3 bg-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800" />{isSearching && <Loader2 className="absolute right-3 top-3 w-5 h-5 text-indigo-600 animate-spin" />}</div>
            <div className="flex space-x-2 overflow-x-auto no-scrollbar pb-1 items-center"><button onClick={() => setShowAddProjectModal(true)} className="px-2.5 py-1.5 rounded-full bg-slate-100 hover:bg-indigo-50 text-indigo-600 transition-colors flex-shrink-0"><Plus className="w-4 h-4" /></button><div className="h-5 w-px bg-slate-200 mx-1 flex-shrink-0"></div><button onClick={() => setSelectedRootCategory('All')} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 ${selectedRootCategory === 'All' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>All</button>{availableCategories.map(cat => <button key={cat} onClick={() => setSelectedRootCategory(cat)} className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap flex-shrink-0 ${selectedRootCategory === cat ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}`}>{cat}</button>)}</div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 pb-24 no-scrollbar">
            {searchResult && <div className="mb-8 bg-indigo-50 p-4 rounded-xl border border-indigo-100"><div className="flex items-center space-x-2 mb-2 text-indigo-700 font-bold text-sm"><Sparkles className="w-4 h-4" /><span>AI Answer</span></div><ReactMarkdown className="text-slate-700 text-sm prose prose-sm prose-indigo">{searchResult}</ReactMarkdown><button onClick={() => setSearchResult(null)} className="mt-2 text-xs text-indigo-500 underline">Clear</button></div>}
            {Object.keys(groupedData).length === 0 ? <div className="text-center py-20 opacity-50"><p>No memories found.</p></div> : <div className="space-y-3">{groupedData['General'] && <div className="mb-6 space-y-3">{Object.values(groupedData['General']).map(mems => mems.flatMap((m, i) => m.structuredContent.map((item, idx) => <MemoryCard key={`gen-${m.id}-${idx}`} item={item} displayDate={item.targetDate || formatDate(m.createdAt)} attachedImage={m.attachedImage} onDelete={() => handleDeleteMemoryItem(m.id, idx)} onUpdate={(u) => handleUpdateMemoryItem(m.id, idx, u)} />)))}</div>}{Object.keys(groupedData).filter(p => p !== 'General').map(projectName => { const isExpanded = expandedProjects.has(projectName); const subProjects = groupedData[projectName]; return (<div key={projectName} className="bg-white rounded-xl overflow-hidden border border-slate-200 shadow-sm"><button onClick={() => toggleFolder(projectName)} className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 transition-colors"><div className="flex items-center space-x-3">{isExpanded ? <FolderOpen className="w-6 h-6 text-indigo-500 fill-indigo-50" /> : <Folder className="w-6 h-6 text-slate-400 fill-slate-50" />}<span className="font-bold text-slate-800">{projectName}</span><span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{Object.values(subProjects).reduce((acc, curr) => acc + curr.length, 0)} items</span></div>{isExpanded ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}</button>{isExpanded && (<div className="bg-slate-50 border-t border-slate-100 p-3 space-y-4">{Object.keys(subProjects).map(subProjectName => (<div key={subProjectName}>{(subProjectName !== 'General' || Object.keys(subProjects).length > 1) && <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 ml-1">{subProjectName}</h4>}<div className="grid gap-3">{subProjects[subProjectName].flatMap(mem => mem.structuredContent.map((item, idx) => <MemoryCard key={`${mem.id}-${idx}`} item={item} displayDate={item.targetDate || formatDate(mem.createdAt)} attachedImage={mem.attachedImage} onDelete={() => handleDeleteMemoryItem(mem.id, idx)} onUpdate={(u) => handleUpdateMemoryItem(mem.id, idx, u)} />))}</div></div>))}</div>)}</div>); })}</div>}
          </div>
          {/* Modals */}
          {showAddProjectModal && <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-sm p-6 shadow-2xl"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">New Project</h3><button onClick={() => setShowAddProjectModal(false)}><X className="w-6 h-6 text-slate-400" /></button></div><div className="space-y-4"><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label><div className="flex flex-wrap gap-2">{availableCategories.map(cat => <button key={cat} onClick={() => setNewProjectCategory(cat)} className={`px-3 py-1 rounded-md text-xs font-medium border ${newProjectCategory === cat ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-slate-200'}`}>{cat}</button>)}</div></div><div><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Name</label><input value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className="w-full p-3 bg-slate-50 border rounded-xl outline-none" autoFocus /></div><button onClick={() => handleAddProject()} disabled={!newProjectName.trim()} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl mt-4 disabled:opacity-50">Create</button></div></div></div>}
          {showCategoryManager && <div className="absolute inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"><div className="bg-white rounded-2xl w-full max-w-2xl h-[80vh] shadow-2xl flex overflow-hidden"><div className="w-1/3 bg-slate-50 border-r border-slate-200 p-4 flex flex-col"><h3 className="text-sm font-bold text-slate-800 mb-4 uppercase tracking-wider">Categories</h3><div className="flex-1 overflow-y-auto space-y-2 no-scrollbar">{availableCategories.map(cat => <div key={cat} onClick={() => setManagerSelectedCategory(cat)} className={`p-3 rounded-lg cursor-pointer flex justify-between items-center group ${managerSelectedCategory === cat ? 'bg-white shadow-sm text-indigo-700' : 'hover:bg-slate-200'}`}><span className="text-sm font-medium">{cat}</span><button onClick={(e) => {e.stopPropagation(); handleDeleteCategory(cat)}} className="opacity-0 group-hover:opacity-100 hover:text-red-500"><Trash2 className="w-3 h-3" /></button></div>)}</div><div className="pt-4 border-t"><input value={tempCategoryName} onChange={(e) => setTempCategoryName(e.target.value)} placeholder="New..." className="w-full p-2 border rounded mb-2 text-sm"/><button onClick={handleAddCategory} disabled={!tempCategoryName.trim()} className="w-full bg-slate-800 text-white py-2 rounded text-xs font-bold disabled:opacity-50">Add</button></div></div><div className="w-2/3 p-6 flex flex-col bg-white"><div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-slate-800">{managerSelectedCategory || 'Select'}</h3><button onClick={() => setShowCategoryManager(false)}><X className="w-5 h-5 text-slate-400"/></button></div>{!managerSelectedCategory ? <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">Select a category</div> : <><div className="flex-1 overflow-y-auto space-y-2 pr-2 no-scrollbar"><div className="p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-indigo-700 text-sm font-medium flex items-center"><Layers className="w-4 h-4 mr-2"/>General</div>{getProjectHierarchy()[managerSelectedCategory]?.map(proj => <div key={proj} className="p-3 border rounded-lg flex justify-between items-center group"><div className="flex items-center space-x-3"><Folder className="w-4 h-4 text-slate-400"/><input defaultValue={proj} onBlur={(e) => handleUpdateProjectName(proj, e.target.value)} className="text-sm font-medium outline-none"/></div><button onClick={() => handleDeleteProject(proj)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100"><Trash2 className="w-4 h-4"/></button></div>)}</div><div className="pt-6 border-t mt-4"><div className="flex space-x-2"><input value={tempProjectName} onChange={(e) => setTempProjectName(e.target.value)} placeholder="Project Name" className="flex-1 p-2.5 bg-slate-50 border rounded-xl text-sm outline-none"/><button onClick={() => handleAddProject(managerSelectedCategory)} disabled={!tempProjectName.trim()} className="px-4 bg-indigo-600 text-white font-bold rounded-xl text-sm disabled:opacity-50">Add</button></div></div></>}</div></div></div>}
        </div>
      );
  };

  return (
    <div className="max-w-md mx-auto bg-white h-screen shadow-2xl overflow-hidden flex flex-col font-sans">
        {/* ✅ ✅ ✅ 这里的 Key 检查已经修正 */}
        {!(import.meta.env.VITE_GEMINI_API_KEY || import.meta.env.VITE_DEEPSEEK_API_KEY) && (
            <div className="bg-red-500 text-white text-xs p-1 text-center font-bold">WARNING: No API Key configured.</div>
        )}
        
        <div className="flex-1 overflow-hidden relative">
            {currentTab === AppTab.INPUT && renderInputView()}
            {currentTab === AppTab.TODAY && renderTodayView()}
            {currentTab === AppTab.MEMORY && renderMemoryView()}
        </div>
        
        {currentTab !== AppTab.INPUT && (
             <button onClick={() => { setShowChat(true); if(coachChat.length===0) setCoachChat([{ role: 'model', text: "Hello! I'm MyOS. Ask me anything!", timestamp: Date.now() }]); }} className="absolute bottom-20 right-6 z-40 bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg transition-transform hover:scale-105">
                <MessageSquare className="w-6 h-6" />
             </button>
        )}
        
        {showChat && (
        <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in slide-in-from-bottom-5">
            <div className="p-4 border-b flex justify-between items-center bg-white shadow-sm">
                <div className="flex items-center space-x-2"><div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold">AI</div><div className="font-bold text-slate-800">MyOS Agent</div></div>
                <button onClick={() => setShowChat(false)} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1 rounded-full text-xs font-medium">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
                {coachChat.map((msg, idx) => (
                    <div key={idx} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'} mb-4`}>
                        {/* ✅ ✅ ✅ 这里使用了 ReactMarkdown 渲染聊天气泡 */}
                        <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'}`}>
                           {msg.role === 'user' ? (
                               <div className="whitespace-pre-wrap">{msg.text}</div>
                           ) : (
                               <ReactMarkdown 
                                 components={{
                                     strong: ({node, ...props}) => <span className="font-bold" {...props} />,
                                     ul: ({node, ...props}) => <ul className="list-disc pl-4 my-1" {...props} />,
                                     ol: ({node, ...props}) => <ol className="list-decimal pl-4 my-1" {...props} />,
                                     li: ({node, ...props}) => <li className="my-0.5" {...props} />,
                                     p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />
                                 }}
                               >
                                   {msg.text}
                               </ReactMarkdown>
                           )}
                        </div>
                        {msg.role !== 'model' || msg.text !== "Thinking..." ? <span className={`text-[10px] text-slate-400 mt-1 px-1 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span> : null}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            <div className="p-4 bg-white border-t border-slate-100 pb-8">
                 <div className="flex items-center space-x-2 bg-slate-100 p-1.5 rounded-full border border-slate-200 focus-within:ring-2 focus-within:ring-indigo-100">
                    <input type="text" placeholder="Ask about your plans..." className="flex-1 bg-transparent outline-none text-sm px-3 py-2" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') handleSendChatMessage(); }} />
                    <button onClick={handleSendChatMessage} disabled={!chatInput.trim()} className="p-2.5 bg-indigo-600 rounded-full text-white shadow-md"><Send className="w-4 h-4" /></button>
                 </div>
            </div>
        </div>
        )}
        <TabNavigation currentTab={currentTab} onTabChange={setCurrentTab} />
    </div>
  );
};