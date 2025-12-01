
import React, { useState, useEffect } from 'react';
import { StructuredItem } from '../types';
import { MapPin, ShoppingBag, Camera, Utensils, StickyNote, Trash2, Calendar, Edit2, Check, X, ImageIcon, Maximize2 } from 'lucide-react';

interface MemoryCardProps {
  item: StructuredItem;
  displayDate: string;
  attachedImage?: string;
  onDelete: () => void;
  onUpdate: (updatedItem: StructuredItem) => void;
}

const MemoryCard: React.FC<MemoryCardProps> = ({ item, displayDate, attachedImage, onDelete, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedItem, setEditedItem] = useState<StructuredItem>(item);
  const [showImageModal, setShowImageModal] = useState(false);

  // Sync state with props when not editing, ensuring fresh data
  useEffect(() => {
    if (!isEditing) {
        setEditedItem(item);
    }
  }, [item, isEditing]);

  const getIcon = (cat: string) => {
    const c = cat.toLowerCase();
    if (c.includes('food') || c.includes('eat')) return <Utensils className="w-4 h-4" />;
    if (c.includes('shop') || c.includes('buy')) return <ShoppingBag className="w-4 h-4" />;
    if (c.includes('photo') || c.includes('sight')) return <Camera className="w-4 h-4" />;
    if (c.includes('map') || c.includes('location')) return <MapPin className="w-4 h-4" />;
    return <StickyNote className="w-4 h-4" />;
  };

  const handleSave = () => {
      onUpdate(editedItem);
      setIsEditing(false);
  };

  const handleCancel = () => {
      setEditedItem(item);
      setIsEditing(false);
  };

  if (isEditing) {
      return (
        <div className="bg-white p-4 rounded-xl shadow-md border-2 border-indigo-100 relative animate-in fade-in zoom-in-95">
             <div className="flex justify-end space-x-2 mb-3">
                <button onClick={handleCancel} className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500">
                    <X className="w-4 h-4" />
                </button>
                <button onClick={handleSave} className="p-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md">
                    <Check className="w-4 h-4" />
                </button>
             </div>

             <div className="space-y-3">
                <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Title</label>
                    <input 
                        className="w-full text-lg font-bold text-slate-800 border-b border-slate-200 focus:border-indigo-500 outline-none pb-1"
                        value={editedItem.title}
                        onChange={(e) => setEditedItem({...editedItem, title: e.target.value})}
                    />
                </div>
                
                <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Description</label>
                    <textarea 
                        className="w-full text-sm text-slate-600 border border-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none resize-none"
                        rows={3}
                        value={editedItem.description}
                        onChange={(e) => setEditedItem({...editedItem, description: e.target.value})}
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                     <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Date (YYYY.MM.DD)</label>
                        <input 
                            className="w-full text-xs text-slate-700 border border-slate-200 rounded p-2 focus:border-indigo-500 outline-none"
                            value={editedItem.targetDate || ''}
                            onChange={(e) => setEditedItem({...editedItem, targetDate: e.target.value})}
                            placeholder="YYYY.MM.DD"
                        />
                    </div>
                     <div>
                        <label className="text-[10px] uppercase font-bold text-slate-400">Location</label>
                        <input 
                            className="w-full text-xs text-slate-700 border border-slate-200 rounded p-2 focus:border-indigo-500 outline-none"
                            value={editedItem.location || ''}
                            onChange={(e) => setEditedItem({...editedItem, location: e.target.value})}
                            placeholder="e.g. Gangnam"
                        />
                    </div>
                </div>

                <div>
                    <label className="text-[10px] uppercase font-bold text-slate-400">Action Item / Note</label>
                    <input 
                        className="w-full text-xs text-slate-700 border border-slate-200 rounded p-2 focus:border-indigo-500 outline-none"
                        value={editedItem.actionItem || ''}
                        onChange={(e) => setEditedItem({...editedItem, actionItem: e.target.value})}
                        placeholder="Optional note..."
                    />
                </div>
             </div>
        </div>
      );
  }

  return (
    <>
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow relative group">
      <div className="flex justify-between items-start mb-2 pr-16">
        <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-1 text-indigo-600 font-medium text-xs bg-indigo-50 px-2 py-1 rounded-md">
                {getIcon(item.category)}
                <span>{item.category}</span>
            </div>
            {/* Subtle Date Badge */}
            <div className="flex items-center space-x-1 text-slate-400 text-xs px-2 py-1 bg-slate-50 rounded-md border border-slate-100">
                <Calendar className="w-3 h-3" />
                <span>{displayDate}</span>
            </div>
        </div>
      </div>
      
      {/* Actions */}
      <div className="absolute top-3 right-3 flex space-x-1 z-20">
        <button 
            onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
            }}
            className="p-2 bg-white hover:bg-indigo-50 text-slate-300 hover:text-indigo-500 rounded-full transition-all shadow-sm border border-transparent hover:border-indigo-100"
            title="Edit Item"
        >
            <Edit2 className="w-4 h-4" />
        </button>
        <button 
            onClick={(e) => {
                e.stopPropagation();
                onDelete();
            }}
            className="p-2 bg-white hover:bg-red-50 text-slate-300 hover:text-red-500 rounded-full transition-all shadow-sm border border-transparent hover:border-red-100"
            title="Delete Item"
        >
            <Trash2 className="w-4 h-4" />
        </button>
      </div>
      
      <div className="flex gap-3">
          <div className="flex-1">
            <h3 className="font-bold text-gray-800 text-lg mb-1">{item.title}</h3>
            <p className="text-gray-600 text-sm mb-3 leading-relaxed whitespace-pre-wrap">{item.description}</p>
          </div>
          
          {/* Thumbnail Preview */}
          {attachedImage && (
             <button 
                onClick={() => setShowImageModal(true)}
                className="w-16 h-16 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 relative group/image"
             >
                <img src={`data:image/jpeg;base64,${attachedImage}`} alt="Attachment" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover/image:opacity-100 transition-opacity flex items-center justify-center">
                    <Maximize2 className="w-4 h-4 text-white drop-shadow-md" />
                </div>
             </button>
          )}
      </div>
      
      {item.location && (
        <a 
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(item.location)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center text-xs text-blue-500 hover:text-blue-700 mb-2"
        >
          <MapPin className="w-3 h-3 mr-1" />
          {item.location}
        </a>
      )}

      {item.actionItem && (
        <div className="bg-slate-50 border-l-2 border-indigo-400 p-2 text-xs text-slate-700 mt-2">
          <span className="font-semibold text-indigo-900">Note: </span>
          {item.actionItem}
        </div>
      )}
    </div>

    {/* Full Screen Image Modal */}
    {showImageModal && attachedImage && (
        <div 
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in"
            onClick={() => setShowImageModal(false)}
        >
            <button 
                onClick={() => setShowImageModal(false)}
                className="absolute top-4 right-4 p-2 bg-white/10 text-white rounded-full hover:bg-white/20"
            >
                <X className="w-6 h-6" />
            </button>
            <img 
                src={`data:image/jpeg;base64,${attachedImage}`} 
                alt="Full view" 
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                onClick={(e) => e.stopPropagation()} 
            />
        </div>
    )}
    </>
  );
};

export default MemoryCard;
