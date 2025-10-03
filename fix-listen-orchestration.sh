#!/bin/bash

# Fix orchestration-application.test.ts
sed -i 's/app\.listen(port);$/await startServerAndWait(app, port);/g' src/tests/unit/core/orchestration-application.test.ts
sed -i 's/await new Promise(resolve => setTimeout(resolve, 200));$/await new Promise(resolve => setTimeout(resolve, 100));/g' src/tests/unit/core/orchestration-application.test.ts

# Fix orchestration-middleware.test.ts
sed -i 's/app\.listen(port);$/await startServerAndWait(app, port);/g' src/tests/unit/core/orchestration-middleware.test.ts
sed -i 's/await new Promise(resolve => setTimeout(resolve, 200));$/await new Promise(resolve => setTimeout(resolve, 100));/g' src/tests/unit/core/orchestration-middleware.test.ts

# Fix orchestration-server.test.ts  
sed -i 's/app\.listen(port);$/await startServerAndWait(app, port);/g' src/tests/unit/core/orchestration-server.test.ts
sed -i 's/await new Promise(resolve => setTimeout(resolve, 200));$/await new Promise(resolve => setTimeout(resolve, 100));/g' src/tests/unit/core/orchestration-server.test.ts

echo "✅ Fixed all orchestration test files"
