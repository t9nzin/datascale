RUN:

terminal 1:
cd ./ai-service/
python3 -m uvicorn main:app --host 127.0.0.1 --port 8000

terminal 2:
cd ./server/
node index.ts

terminal 3:
cd ./client/
npm run dev

terminal 4:
cd ./tailscale-admin/service/
npm run dev

terminal 5:
cd ./tailscale-admin/ui/
npm run dev

terminal 6 (run in bg so it doesn't block, can be one terminal):
sudo tailscale serve --bg http://localhost:3000/
sudo tailscale serve --bg --https=8443 http://localhost:5173/
sudo tailscale serve --bg --https=8444 http://localhost:5174/


Will want to probably build these all to apps and have them run in containers for ease, but this also works.

Reason for admin panel is so we can quickly remove a user from all groups AND THEN cut them off from the network if we suspect that device has been breached/compromised. Further, promotion of users to reviewers from annotators is possible which ties in with collaboartion

These URLs are provided by the tailscale magic DNS system which allows for stable domain resolution across the tailnet
annotate: https://fedora.tail39b3f6.ts.net:8443/
admin: https://fedora.tail39b3f6.ts.net:8444/
