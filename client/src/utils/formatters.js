export const formatSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const timeAgo = (date) => {
  if (!date) return 'Never';
  const seconds = Math.floor((new Date() - new Date(date)) / 1000);
  if (seconds < 5) return 'Just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return new Date(date).toLocaleDateString();
};

export const stripTimestamp = (key) => {
  if (!key) return '';
  const name = key.split('/').pop();
  const firstUnderscore = name.indexOf('_');
  if (firstUnderscore > 0 && /^\d+$/.test(name.substring(0, firstUnderscore))) {
    return name.substring(firstUnderscore + 1);
  }
  return name;
};

export const fileIcon = (key) => {
  const name = stripTimestamp(key);
  const ext = name.split('.').pop().toLowerCase();
  const colors = { 
    json: '#10b981', 
    doc: '#3b82f6', 
    docx: '#3b82f6', 
    pdf: '#ef4444', 
    png: '#8b5cf6', 
    jpg: '#8b5cf6', 
    jpeg: '#8b5cf6', 
    txt: '#64748b' 
  };
  return colors[ext] || '#64748b';
};

export const buildChartData = (usedBytes) => {
  const gb = usedBytes / (1024 ** 3);
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Now'];
  return days.map((day, i) => {
    const factor = i === 6 ? 1 : (0.4 + (i * 0.08) + (Math.sin(i * 1.5) * 0.05));
    return {
      name: day,
      cloud: parseFloat((gb * factor).toFixed(5)),
      local: parseFloat((gb * factor * 0.6).toFixed(5))
    };
  });
};
