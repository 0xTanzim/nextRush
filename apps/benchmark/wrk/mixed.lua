-- wrk Lua script: Mixed workload
-- Cycles through GET scenarios to simulate a realistic traffic distribution.
-- Wired via `pnpm bench:mixed` (start a server first: `node servers/<name>.js`).
-- Usage: wrk -t4 -c64 -d10s -s wrk/mixed.lua http://localhost:8080/

-- "/" appears twice intentionally — simulates realistic traffic where the
-- root/hello-world endpoint receives roughly double the traffic (~20%) of
-- other routes, as typically seen in production workloads.
local paths = {
  "/",
  "/",
  "/json",
  "/users/42",
  "/users/99",
  "/search?q=benchmark&limit=5",
  "/api/v1/orgs/1/teams/2/members/3",
  "/middleware",
  "/large-json",
  "/empty",
}

local counter = 0

request = function()
  counter = counter + 1
  local idx = (counter % #paths) + 1
  return wrk.format("GET", paths[idx])
end
