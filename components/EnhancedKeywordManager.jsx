import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// 单个关键词项组件
const SortableKeywordItem = ({ keyword, isSelected, onToggle, onEdit, onDelete, id }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(keyword);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleSaveEdit = () => {
    if (editValue.trim() && editValue !== keyword) {
      onEdit(id, editValue.trim());
    }
    setIsEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSaveEdit();
    } else if (e.key === 'Escape') {
      setEditValue(keyword);
      setIsEditing(false);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center p-3 border rounded-lg transition-all duration-200 ${
        isSelected 
          ? 'border-indigo-300 bg-indigo-50 shadow-sm' 
          : 'border-gray-200 bg-white hover:bg-gray-50'
      } ${isDragging ? 'shadow-lg' : ''}`}
    >
      {/* 拖拽手柄 */}
      <div 
        {...attributes} 
        {...listeners}
        className="mr-3 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3 2h2v2H3V2zm4 0h2v2H7V2zm4 0h2v2h-2V2zM3 6h2v2H3V6zm4 0h2v2H7V6zm4 0h2v2h-2V6zM3 10h2v2H3v-2zm4 0h2v2H7v-2zm4 0h2v2h-2v-2z"/>
        </svg>
      </div>

      {/* 选择框 */}
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggle(id)}
        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-3"
      />

      {/* 关键词内容 */}
      <div className="flex-1">
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyPress}
            onBlur={handleSaveEdit}
            className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-indigo-500"
            autoFocus
          />
        ) : (
          <span 
            className={`text-sm ${isSelected ? 'text-indigo-800 font-medium' : 'text-gray-700'}`}
            onDoubleClick={() => setIsEditing(true)}
          >
            {keyword}
          </span>
        )}
      </div>

      {/* 操作按钮 */}
      <div className="flex space-x-1 ml-3">
        <button
          onClick={() => setIsEditing(true)}
          className="p-1.5 text-gray-400 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
          title="编辑"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="m18.5 2.5 a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
        </button>
        <button
          onClick={() => onDelete(id)}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
          title="删除"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="3,6 5,6 21,6"/>
            <path d="m19,6v14a2,2 0 0,1-2,2H7a2,2 0 0,1-2-2V6m3,0V4a2,2 0 0,1,2-2h4a2,2 0 0,1,2,2v2"/>
            <line x1="10" y1="11" x2="10" y2="17"/>
            <line x1="14" y1="11" x2="14" y2="17"/>
          </svg>
        </button>
      </div>
    </div>
  );
};

const EnhancedKeywordManager = ({ keywords, selectedKeywords = [], onUpdate, onSelectionChange }) => {
  const [newKeyword, setNewKeyword] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 创建带ID的关键词列表
  const keywordsWithIds = keywords.map((keyword, index) => ({
    id: `keyword-${index}`,
    keyword,
    originalIndex: index
  }));

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = keywordsWithIds.findIndex(item => item.id === active.id);
      const newIndex = keywordsWithIds.findIndex(item => item.id === over.id);
      
      const newKeywords = arrayMove(keywords, oldIndex, newIndex);
      onUpdate(newKeywords);
    }
  };

  const handleToggleKeyword = (keywordId) => {
    const keyword = keywordsWithIds.find(item => item.id === keywordId);
    if (!keyword) return;

    const newSelected = selectedKeywords.includes(keyword.keyword)
      ? selectedKeywords.filter(k => k !== keyword.keyword)
      : [...selectedKeywords, keyword.keyword];
    
    onSelectionChange(newSelected);
  };

  const handleEditKeyword = (keywordId, newValue) => {
    const itemIndex = keywordsWithIds.findIndex(item => item.id === keywordId);
    if (itemIndex === -1) return;

    const newKeywords = [...keywords];
    newKeywords[itemIndex] = newValue;
    onUpdate(newKeywords);

    // 更新选中状态
    const oldKeyword = keywords[itemIndex];
    if (selectedKeywords.includes(oldKeyword)) {
      const newSelected = selectedKeywords.map(k => k === oldKeyword ? newValue : k);
      onSelectionChange(newSelected);
    }
  };

  const handleDeleteKeyword = (keywordId) => {
    const item = keywordsWithIds.find(item => item.id === keywordId);
    if (!item) return;

    const newKeywords = keywords.filter((_, index) => index !== item.originalIndex);
    onUpdate(newKeywords);

    // 从选中列表中移除
    const newSelected = selectedKeywords.filter(k => k !== item.keyword);
    onSelectionChange(newSelected);
  };

  const handleAddKeyword = () => {
    if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) {
      const updatedKeywords = [...keywords, newKeyword.trim()];
      onUpdate(updatedKeywords);
      setNewKeyword('');
      setShowAddForm(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleAddKeyword();
    } else if (e.key === 'Escape') {
      setNewKeyword('');
      setShowAddForm(false);
    }
  };

  const handleSelectAll = () => {
    onSelectionChange([...keywords]);
  };

  const handleSelectNone = () => {
    onSelectionChange([]);
  };

  return (
    <div className="space-y-4">
      {/* 头部操作区 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-800">
            关键词配置 ({selectedKeywords.length}/{keywords.length} 已选择)
          </h3>
          <div className="flex space-x-2">
            <button
              onClick={handleSelectAll}
              className="text-xs px-2 py-1 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition-colors"
            >
              全选
            </button>
            <button
              onClick={handleSelectNone}
              className="text-xs px-2 py-1 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded transition-colors"
            >
              全不选
            </button>
          </div>
        </div>
        
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="flex items-center px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          添加关键词
        </button>
      </div>

      {/* 添加关键词表单 */}
      {showAddForm && (
        <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
          <div className="flex space-x-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="输入新关键词"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
            <button
              onClick={handleAddKeyword}
              disabled={!newKeyword.trim() || keywords.includes(newKeyword.trim())}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
            >
              添加
            </button>
            <button
              onClick={() => {
                setNewKeyword('');
                setShowAddForm(false);
              }}
              className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              取消
            </button>
          </div>
          {newKeyword.trim() && keywords.includes(newKeyword.trim()) && (
            <p className="text-sm text-red-600 mt-2">该关键词已存在</p>
          )}
        </div>
      )}

      {/* 关键词列表 */}
      <div className="space-y-2">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={keywordsWithIds.map(item => item.id)}
            strategy={verticalListSortingStrategy}
          >
            {keywordsWithIds.map((item) => (
              <SortableKeywordItem
                key={item.id}
                id={item.id}
                keyword={item.keyword}
                isSelected={selectedKeywords.includes(item.keyword)}
                onToggle={handleToggleKeyword}
                onEdit={handleEditKeyword}
                onDelete={handleDeleteKeyword}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      {/* 空状态 */}
      {keywords.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"/>
          </svg>
          <p>暂无关键词，点击"添加关键词"开始配置</p>
        </div>
      )}

      {/* 使用说明 */}
      <div className="text-xs text-gray-500 p-3 bg-blue-50 rounded-lg">
        <p className="font-medium mb-1">使用说明：</p>
        <ul className="space-y-1">
          <li>• 拖拽 ⋮⋮ 图标可调整关键词优先级顺序</li>
          <li>• 勾选关键词以启用抓取，未勾选的关键词将被跳过</li>
          <li>• 双击关键词文本可快速编辑</li>
          <li>• 系统将按照列表顺序依次搜索已选择的关键词</li>
        </ul>
      </div>
    </div>
  );
};

export default EnhancedKeywordManager; 