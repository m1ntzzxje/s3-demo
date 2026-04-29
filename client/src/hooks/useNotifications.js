import { useState, useEffect, useCallback } from 'react';

export default function useNotifications(user) {
  const [notifications, setNotifications] = useState(() => {
    try {
      if (!user) return [];
      const saved = localStorage.getItem(`esoft_notif_${user.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const [activities, setActivities] = useState(() => {
    try {
      if (!user) return [];
      const saved = localStorage.getItem(`esoft_acts_${user.id}`);
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  useEffect(() => {
    if (user) {
      try {
        const savedNotifs = localStorage.getItem(`esoft_notif_${user.id}`);
        const savedActs = localStorage.getItem(`esoft_acts_${user.id}`);
        setNotifications(savedNotifs ? JSON.parse(savedNotifs) : []);
        setActivities(savedActs ? JSON.parse(savedActs) : []);
      } catch {
        setNotifications([]);
        setActivities([]);
      }
    } else {
      setNotifications([]);
      setActivities([]);
    }
  }, [user]);

  useEffect(() => {
    if (user && (notifications.length > 0 || activities.length > 0)) {
      localStorage.setItem(`esoft_notif_${user.id}`, JSON.stringify(notifications));
      localStorage.setItem(`esoft_acts_${user.id}`, JSON.stringify(activities));
    }
  }, [notifications, activities, user]);

  const pushNotif = useCallback((type, text, icon) => {
    setNotifications(prev => [{ id: Date.now() + Math.random(), type, text, icon, time: new Date().toISOString() }, ...prev].slice(0, 10));
  }, []);

  const pushActivity = useCallback((text, icon, color) => {
    setActivities(prev => [{ id: Date.now() + Math.random(), text, icon, color, time: new Date().toISOString() }, ...prev].slice(0, 15));
  }, []);

  return { notifications, setNotifications, activities, setActivities, pushNotif, pushActivity };
}
