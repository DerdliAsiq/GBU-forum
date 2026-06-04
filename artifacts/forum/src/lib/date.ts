export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  const diffInHours = Math.floor(diffInMinutes / 60);
  const diffInDays = Math.floor(diffInHours / 24);
  const diffInMonths = Math.floor(diffInDays / 30);
  const diffInYears = Math.floor(diffInDays / 365);

  if (diffInSeconds < 60) return 'İndi';
  if (diffInMinutes < 60) return `${diffInMinutes} dəqiqə əvvəl`;
  if (diffInHours < 24) return `${diffInHours} saat əvvəl`;
  if (diffInDays < 30) return `${diffInDays} gün əvvəl`;
  if (diffInMonths < 12) return `${diffInMonths} ay əvvəl`;
  
  return `${diffInYears} il əvvəl`;
}

export function formatFullDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('az-AZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}
