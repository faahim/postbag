# PLACEHOLDER — proves the deploy pipeline end-to-end before the real app exists.
# Replaced by the multi-stage build when apps/server lands (see PROGRESS.md).
FROM node:22-alpine
WORKDIR /app
RUN printf '%s\n' \
  'const http=require("http");' \
  'const body=JSON.stringify({ok:true,service:"postbag",phase:"placeholder",version:process.env.SOURCE_COMMIT||"dev"});' \
  'http.createServer((req,res)=>{res.writeHead(200,{"content-type":"application/json"});res.end(body)}).listen(3000,()=>console.log("postbag placeholder on :3000"));' \
  > server.js
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["node","server.js"]
