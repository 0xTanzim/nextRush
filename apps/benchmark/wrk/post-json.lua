-- wrk Lua script: POST JSON body
-- Usage: wrk -s wrk/post-json.lua http://localhost:3000/users

wrk.method = "POST"
wrk.body   = '{"name":"John Doe","email":"john@example.com"}'
wrk.headers["Content-Type"] = "application/json"
