// KinectB2B Affiliate Portal Service Worker
const CACHE_NAME = 'kinectb2b-affiliate-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'
];

// Install event
self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache opened');
        return cache.addAll(urlsToCache);
      })
      .catch(error => {
        console.error('Cache failed to open:', error);
      })
  );
});

// Activate event
self.addEventListener('activate', event => {
  console.log('Service Worker activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Fetch event - Network First strategy for dynamic content
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('supabase') &&
      !event.request.url.includes('googleapis.com') &&
      !event.request.url.includes('jsdelivr.net')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // Check if we received a valid response
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }

        // Clone the response
        const responseToCache = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => {
            cache.put(event.request, responseToCache);
          });

        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request)
          .then(response => {
            if (response) {
              return response;
            }
            
            // If no cache match, return offline page for navigation requests
            if (event.request.mode === 'navigate') {
              return caches.match('/').then(response => {
                return response || new Response('App is offline', {
                  status: 503,
                  statusText: 'Service Unavailable',
                  headers: new Headers({
                    'Content-Type': 'text/plain'
                  })
                });
              });
            }
            
            return new Response('Offline', {
              status: 503,
              statusText: 'Service Unavailable'
            });
          });
      })
  );
});

// Background sync for offline form submissions
self.addEventListener('sync', event => {
  console.log('Background sync triggered:', event.tag);
  
  if (event.tag === 'background-referral-sync') {
    event.waitUntil(syncReferrals());
  } else if (event.tag === 'background-question-sync') {
    event.waitUntil(syncQuestions());
  }
});

// Push notifications
self.addEventListener('push', event => {
  console.log('Push notification received');
  
  const options = {
    body: 'You have new activity in your affiliate portal',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTkyIiBoZWlnaHQ9IjE5MiIgdmlld0JveD0iMCAwIDE5MiAxOTIiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjE5MiIgaGVpZ2h0PSIxOTIiIHJ4PSIzMiIgZmlsbD0iIzI1NjNFQiIvPjx0ZXh0IHg9Ijk2IiB5PSIxMTAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSI4NCIgZm9udC13ZWlnaHQ9ImJvbGQiIGZpbGw9IndoaXRlIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIj5LPC90ZXh0Pjx0ZXh0IHg9Ijk2IiB5PSIxNDAiIGZvbnQtZmFtaWx5PSJBcmlhbCIgZm9udC1zaXplPSIyNCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPkFmZmlsaWF0ZXM8L3RleHQ+PC9zdmc+',
    badge: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iOTYiIGhlaWdodD0iOTYiIHZpZXdCb3g9IjAgMCA5NiA5NiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48Y2lyY2xlIGN4PSI0OCIgY3k9IjQ4IiByPSI0OCIgZmlsbD0iIzI1NjNFQiIvPjx0ZXh0IHg9IjQ4IiB5PSI1OCIgZm9udC1mYW1pbHk9IkFyaWFsIiBmb250LXNpemU9IjQ4IiBmb250LXdlaWdodD0iYm9sZCIgZmlsbD0id2hpdGUiIHRleHQtYW5jaG9yPSJtaWRkbGUiPks8L3RleHQ+PC9zdmc+',
    tag: 'kinectb2b-notification',
    requireInteraction: true,
    actions: [
      {
        action: 'open',
        title: 'Open Portal'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  let title = 'KinectB2B Affiliate Portal';
  let body = 'You have new activity';

  if (event.data) {
    const data = event.data.json();
    title = data.title || title;
    body = data.body || body;
    
    if (data.type === 'referral_update') {
      title = 'Referral Update';
      body = `Your referral "${data.company}" status changed to ${data.status}`;
    } else if (data.type === 'payment') {
      title = 'Payment Received';
      body = `You received $${data.amount} commission payment`;
    } else if (data.type === 'question_response') {
      title = 'Question Answered';
      body = 'Your question has been answered by our team';
    }
    
    options.body = body;
  }

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked:', event.notification.tag);
  
  event.notification.close();

  if (event.action === 'open' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clients => {
        // Check if app is already open
        for (const client of clients) {
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Open new window if app isn't open
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Sync functions for offline functionality
async function syncReferrals() {
  try {
    console.log('Syncing offline referrals...');
    
    // Get offline stored referrals from IndexedDB
    const offlineReferrals = await getOfflineData('referrals');
    
    for (const referral of offlineReferrals) {
      try {
        // Attempt to sync with server
        const response = await fetch('/api/referrals', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(referral)
        });
        
        if (response.ok) {
          // Remove from offline storage
          await removeOfflineData('referrals', referral.id);
          console.log('Referral synced successfully');
        }
      } catch (error) {
        console.error('Failed to sync referral:', error);
      }
    }
  } catch (error) {
    console.error('Error syncing referrals:', error);
  }
}

async function syncQuestions() {
  try {
    console.log('Syncing offline questions...');
    
    const offlineQuestions = await getOfflineData('questions');
    
    for (const question of offlineQuestions) {
      try {
        const response = await fetch('/api/questions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(question)
        });
        
        if (response.ok) {
          await removeOfflineData('questions', question.id);
          console.log('Question synced successfully');
        }
      } catch (error) {
        console.error('Failed to sync question:', error);
      }
    }
  } catch (error) {
    console.error('Error syncing questions:', error);
  }
}

// IndexedDB helpers for offline storage
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('KinectB2BOffline', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = event => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('referrals')) {
        const referralStore = db.createObjectStore('referrals', { keyPath: 'id' });
        referralStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
      
      if (!db.objectStoreNames.contains('questions')) {
        const questionStore = db.createObjectStore('questions', { keyPath: 'id' });
        questionStore.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

async function getOfflineData(storeName) {
  try {
    const db = await openDB();
    const transaction = db.transaction([storeName], 'readonly');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  } catch (error) {
    console.error('Error getting offline data:', error);
    return [];
  }
}

async function removeOfflineData(storeName, id) {
  try {
    const db = await openDB();
    const transaction = db.transaction([storeName], 'readwrite');
    const store = transaction.objectStore(storeName);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  } catch (error) {
    console.error('Error removing offline data:', error);
  }
}

// Message handler for communication with main app
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});