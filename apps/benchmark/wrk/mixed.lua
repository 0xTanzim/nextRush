-- wrk Lua script: Mixed workload
-- Cycles through all GET scenarios to simulate realistic traffic distribution.
-- Usage: wrk -s wrk/mixed.lua http://localhost:3000

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
