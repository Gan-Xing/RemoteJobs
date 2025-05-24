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
import { regions } from '../utils/regions';

// 单个国家项组件
const SortableCountryItem = ({ countryItem, onToggle, onPin }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: countryItem.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center p-3 border rounded-lg transition-all duration-200 cursor-pointer ${
        countryItem.enabled
          ? 'border-indigo-300 bg-indigo-50 shadow-sm'
          : 'border-gray-200 bg-white hover:bg-gray-50'
      } ${isDragging ? 'shadow-lg' : ''}`}
      onClick={() => onToggle(countryItem.id)}
    >
      {/* 顺序显示 */}
      <div className="mr-3 text-xs text-gray-500 font-mono w-6 text-center">
        {countryItem.order}
      </div>

      {/* 拖拽手柄 */}
      <div 
        {...attributes} 
        {...listeners}
        className="mr-3 cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600"
        onClick={(e) => e.stopPropagation()}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M3 2h2v2H3V2zm4 0h2v2H7V2zm4 0h2v2h-2V2zM3 6h2v2H3V6zm4 0h2v2H7V6zm4 0h2v2h-2V6zM3 10h2v2H3v-2zm4 0h2v2H7v-2zm4 0h2v2h-2v-2z"/>
        </svg>
      </div>

      {/* 选择框 */}
      <input
        type="checkbox"
        checked={countryItem.enabled}
        onChange={(e) => {
          e.stopPropagation();
          onToggle(countryItem.id);
        }}
        className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 mr-3"
      />

      {/* 国家信息 */}
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <span 
            className={`text-sm ${
              countryItem.enabled 
                ? 'text-indigo-800 font-medium' 
                : 'text-gray-700'
            }`}
          >
            {countryItem.name}
          </span>
          <div className="flex items-center space-x-4">
            <div className="text-xs text-gray-500">
              {countryItem.code.toUpperCase()}
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPin(countryItem.id);
              }}
              className={`p-1 rounded hover:bg-gray-100 ${
                countryItem.pinned ? 'text-indigo-600' : 'text-gray-400'
              }`}
              title="置顶"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 19V5M5 12l7-7 7 7"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const CountryConfigManager = ({ countryItems = [], onUpdate }) => {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // 按order排序的国家列表
  const sortedCountries = [...countryItems].sort((a, b) => a.order - b.order);

  // 获取所有可用国家
  const getAllAvailableCountries = () => {
    const allCountries = [];
    Object.values(regions).forEach(region => {
      region.countries.forEach(country => {
        // 生成国家代码（简单的映射逻辑）
        const code = getCountryCode(country.name);
        allCountries.push({
          ...country,
          code
        });
      });
    });
    return allCountries;
  };

  // 简单的国家名称到代码的映射
  const getCountryCode = (name) => {
    const mapping = {
      '美国': 'us', '加拿大': 'ca', '英国': 'uk', '德国': 'de', '法国': 'fr',
      '澳大利亚': 'au', '日本': 'jp', '韩国': 'kr', '新加坡': 'sg', '中国': 'cn',
      '西班牙': 'es', '意大利': 'it', '荷兰': 'nl', '瑞士': 'ch', '瑞典': 'se',
      '爱尔兰': 'ie', '挪威': 'no', '比利时': 'be', '奥地利': 'at', '波兰': 'pl',
      '葡萄牙': 'pt', '俄罗斯': 'ru', '阿联酋': 'ae', '印度': 'in',
      '巴西': 'br', '墨西哥': 'mx', '南非': 'za', '阿根廷': 'ar'
    };
    return mapping[name] || name.toLowerCase().substr(0, 2);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = sortedCountries.findIndex(item => item.id === active.id);
      const newIndex = sortedCountries.findIndex(item => item.id === over.id);
      
      const reorderedCountries = arrayMove(sortedCountries, oldIndex, newIndex);
      
      // 重新分配order值
      const updatedCountries = reorderedCountries.map((item, index) => ({
        ...item,
        order: index + 1
      }));
      
      onUpdate(updatedCountries);
    }
  };

  const handleToggleCountry = (countryId) => {
    const updatedCountries = countryItems.map(item => 
      item.id === countryId 
        ? { ...item, enabled: !item.enabled }
        : item
    );
    onUpdate(updatedCountries);
  };

  const handleSelectAll = () => {
    const updatedCountries = countryItems.map(item => ({ ...item, enabled: true }));
    onUpdate(updatedCountries);
  };

  const handleSelectNone = () => {
    const updatedCountries = countryItems.map(item => ({ ...item, enabled: false }));
    onUpdate(updatedCountries);
  };

  const handleResetToDefault = () => {
    const availableCountries = getAllAvailableCountries();
    const defaultCountries = availableCountries.map((country, index) => ({
      id: `country-${country.geoId}`,
      name: country.name,
      code: country.code,
      geoId: country.geoId,
      enabled: index < 5, // 默认启用前5个
      order: index + 1
    }));
    
    onUpdate(defaultCountries);
  };

  const handlePinCountry = (countryId) => {
    const updatedCountries = [...countryItems];
    const index = updatedCountries.findIndex(item => item.id === countryId);
    
    if (index !== -1) {
      // 将目标国家移到数组开头
      const [movedItem] = updatedCountries.splice(index, 1);
      updatedCountries.unshift(movedItem);
      
      // 重新分配order值
      const finalCountries = updatedCountries.map((item, index) => ({
        ...item,
        order: index + 1
      }));
      
      onUpdate(finalCountries);
    }
  };

  // 统计数据
  const enabledCount = countryItems.filter(item => item.enabled).length;
  const totalCount = countryItems.length;

  return (
    <div className="space-y-4">
      {/* 头部操作区 */}
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold text-gray-800">
            国家/地区配置 ({enabledCount}/{totalCount} 已启用)
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
          onClick={handleResetToDefault}
          className="flex items-center px-3 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="mr-1">
            <polyline points="23,4 23,10 17,10"/>
            <polyline points="1,20 1,14 7,14"/>
            <path d="m3.51,9a9,9 0 0,1,14.85-3.36L23,10M1,14l4.64,4.36A9,9 0 0,0,20.49,15"/>
          </svg>
          重置默认
        </button>
      </div>

      {/* 国家列表 */}
      {countryItems.length > 0 ? (
        <div className="space-y-2">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sortedCountries.map(item => item.id)}
              strategy={verticalListSortingStrategy}
            >
              {sortedCountries.map((item) => (
                <SortableCountryItem
                  key={item.id}
                  countryItem={item}
                  onToggle={handleToggleCountry}
                  onPin={handlePinCountry}
                />
              ))}
            </SortableContext>
          </DndContext>
        </div>
      ) : (
        // 空状态
        <div className="text-center py-8 text-gray-500">
          <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <p className="mb-3">暂无国家配置，点击"重置默认"开始配置</p>
          <button
            onClick={handleResetToDefault}
            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition-colors"
          >
            重置默认配置
          </button>
        </div>
      )}

      {/* 使用说明 */}
      <div className="text-xs text-gray-500 p-3 bg-blue-50 rounded-lg">
        <p className="font-medium mb-1">使用说明：</p>
        <ul className="space-y-1">
          <li>• 左侧数字显示搜索优先级，数字越小优先级越高</li>
          <li>• 拖拽 ⋮⋮ 图标可调整国家优先级顺序</li>
          <li>• 勾选国家以启用搜索，未勾选的国家将被跳过</li>
          <li>• 系统将按照优先级顺序依次搜索已启用的国家</li>
          <li>• 每个国家包含名称、代码和LinkedIn的geoId</li>
        </ul>
      </div>
    </div>
  );
};

export default CountryConfigManager; 