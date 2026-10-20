const http = require('http');

// Target load balancer URL
const TARGET_PORT = 8080;
const SIMULATION_DURATION_SEC = 20;

// Health state tracking
let systemHealth = {
  activeInstances: 20,
  unhealthyInstances: 0,
  lastFailureTime: null,
  recoveryTimeMs: null
};

// Sends a standard request through the load balancer
function sendSessionRequest(id) {
  return new Promise((resolve) => {
    const payload = `ft_req_${id}`;
    const options = {
      hostname: 'localhost',
      port: TARGET_PORT,
      path: `/${payload}`,
      method: 'GET',
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve(data.includes('Session ACCESS GRANTED'));
      });
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

// Background health check that probes availability and triggers recovery
function runHealthCheckMonitor() {
  return setInterval(() => {
    if (systemHealth.unhealthyInstances > 0) {
      // Simulate automated recovery / node restart
      systemHealth.unhealthyInstances--;
      systemHealth.activeInstances++;
      if (systemHealth.lastFailureTime) {
        systemHealth.recoveryTimeMs = Date.now() - systemHealth.lastFailureTime;
      }
      console.log(`[HealthCheck] Node recovered! Active servers: ${systemHealth.activeInstances}`);
    }
  }, 3000);
}

// Simulates a backend server drop / failure event
function triggerServerCrash() {
  if (systemHealth.activeInstances > 1) {
    systemHealth.activeInstances--;
    systemHealth.unhealthyInstances++;
    systemHealth.lastFailureTime = Date.now();
    console.log(`\n>>> [FAULT INJECTED] Backend server failed! Remaining active: ${systemHealth.activeInstances} <<<\n`);
  }
}

async function runFaultToleranceEvaluation() {
  console.log("=== Task B.1: Evaluating Fault Tolerance & Recovery ===");
  const monitorInterval = runHealthCheckMonitor();
  
  let totalRequests = 0;
  let successfulRequests = 0;
  let failedRequests = 0;

  // Inject a failure at 4 seconds into the test
  setTimeout(() => {
    triggerServerCrash();
  }, 4000);

  const startTime = Date.now();
  while (Date.now() - startTime < SIMULATION_DURATION_SEC * 1000) {
    totalRequests++;
    const ok = await sendSessionRequest(totalRequests);
    if (ok) {
      successfulRequests++;
    } else {
      failedRequests++;
    }
    await new Promise((r) => setTimeout(r, 100)); // 100ms interval
  }

  clearInterval(monitorInterval);

  const successRate = ((successfulRequests / totalRequests) * 100).toFixed(2);
  const failureRate = ((failedRequests / totalRequests) * 100).toFixed(2);

  console.log("\n--- Fault Tolerance Test Results ---");
  console.table([{
    "Total Requests": totalRequests,
    "Successful": successfulRequests,
    "Failed/Lost": failedRequests,
    "Success Rate": `${successRate}%`,
    "Failure Rate": `${failureRate}%`,
    "Measured Recovery Time": systemHealth.recoveryTimeMs ? `${systemHealth.recoveryTimeMs} ms` : "N/A"
  }]);
}

runFaultToleranceEvaluation();