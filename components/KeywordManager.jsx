import { useState } from 'react';

const KeywordManager = ({ keywords, onUpdate }) => {
  const [newKeyword, setNewKeyword] = useState('');
  const [editingIndex, setEditingIndex] = useState(-1);
  const [editingValue, setEditingValue] = useState('');

  const handleAdd = () => {
    if (newKeyword.trim()) {
      const updatedKeywords = [...keywords, newKeyword.trim()];
      onUpdate(updatedKeywords);
      setNewKeyword('');
    }
  };

  const handleDelete = (index) => {
    const updatedKeywords = keywords.filter((_, i) => i !== index);
    onUpdate(updatedKeywords);
  };

  const handleEdit = (index) => {
    setEditingIndex(index);
    setEditingValue(keywords[index]);
  };

  const handleSaveEdit = () => {
    if (editingValue.trim()) {
      const updatedKeywords = [...keywords];
      updatedKeywords[editingIndex] = editingValue.trim();
      onUpdate(updatedKeywords);
      setEditingIndex(-1);
      setEditingValue('');
    }
  };

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      if (action === 'add') {
        handleAdd();
      } else if (action === 'edit') {
        handleSaveEdit();
      }
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex space-x-2 mb-4">
        <input
          type="text"
          value={newKeyword}
          onChange={(e) => setNewKeyword(e.target.value)}
          onKeyPress={(e) => handleKeyPress(e, 'add')}
          placeholder="输入新关键词"
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />
        <button
          onClick={handleAdd}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          添加
        </button>
      </div>
      
      <div className="space-y-2">
        {keywords.map((keyword, index) => (
          <div key={index} className="flex items-center space-x-2">
            {editingIndex === index ? (
              <>
                <input
                  type="text"
                  value={editingValue}
                  onChange={(e) => setEditingValue(e.target.value)}
                  onKeyPress={(e) => handleKeyPress(e, 'edit')}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <button
                  onClick={handleSaveEdit}
                  className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                >
                  保存
                </button>
              </>
            ) : (
              <>
                <span className="flex-1 px-3 py-2 bg-gray-50 rounded-md">{keyword}</span>
                <button
                  onClick={() => handleEdit(index)}
                  className="px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
                >
                  编辑
                </button>
                <button
                  onClick={() => handleDelete(index)}
                  className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  删除
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default KeywordManager; 