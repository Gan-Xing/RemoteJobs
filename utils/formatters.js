/**
 * 格式化时间（秒）为人类可读格式
 * @param {number} seconds - 需要格式化的秒数
 * @returns {string} 格式化后的时间字符串，格式为"时:分:秒"
 */
export const formatTime = (seconds) => {
  if (seconds === undefined || seconds === null) return "00:00:00";
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;
  
  // 添加前导零
  const formatNumber = (num) => (num < 10 ? `0${num}` : num);
  
  return `${formatNumber(hours)}:${formatNumber(minutes)}:${formatNumber(remainingSeconds)}`;
};

/**
 * 格式化日期时间为本地字符串
 * @param {string|Date} date - 日期对象或ISO日期字符串
 * @returns {string} 格式化后的日期时间字符串
 */
export const formatDateTime = (date) => {
  if (!date) return '-';
  
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  
  // 检查日期是否有效
  if (isNaN(dateObj.getTime())) return '-';
  
  return dateObj.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}; 