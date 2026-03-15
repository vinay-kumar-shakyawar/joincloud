/* JoinCloud Service Worker - retry failed chunk uploads */
const BACKOFFS = [1000, 2000, 4000, 8000, 16000, 30000];

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "PUT") return;
  const url = event.request.url;
  if (!url.includes("/api/v2/upload/chunk")) return;

  event.respondWith(
    event.request.arrayBuffer().then((body) => {
      const doFetch = (attempt = 0) => {
        const delay = BACKOFFS[Math.min(attempt, BACKOFFS.length - 1)];
        return fetch(event.request.url, {
          method: "PUT",
          headers: event.request.headers,
          body,
        }).then((res) => {
          if (res.ok) {
            if (self.clients && attempt > 0) {
              self.clients.matchAll().then((clients) => {
                clients.forEach((c) => c.postMessage({ type: "joincloud-chunk-retry-success", url: event.request.url }));
              });
            }
            return res;
          }
          if (attempt < BACKOFFS.length - 1) {
            return new Promise((r) => setTimeout(r, delay)).then(() => doFetch(attempt + 1));
          }
          return res;
        });
      };
      return doFetch();
    })
  );
});
