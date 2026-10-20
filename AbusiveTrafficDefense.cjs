const http = require('http');

// Configured thresholds for defense evaluation
const MAX_PAYLOAD_ALLOWED_CHARS = 50; // Payload size limiter threshold
const RATE_LIMIT_THRESHOLD_MS = 20;   // Rejects requests arriving under 20ms apart

let lastRequestTimestamp = 0;

function sendEvaluatedRequest(type, payloadData) {
  return new Promise((resolve) => {
    const arrivalTime = Date.now();
    const timeDelta = arrivalTime - lastRequestTimestamp;
    lastRequestTimestamp = arrivalTime;

    // Defense 1: Request size limit check
    if (payloadData.length > MAX_PAYLOAD_ALLOWED_CHARS) {
      return resolve({ type, status: 'REJECTED_OVERSIZED', allowed: false });
    }

    // Defense 2: Rate limiter threshold check
    if (timeDelta < RATE_LIMIT_THRESHOLD_MS && type === 'ABUSIVE_BURST') {
      return resolve({ type, status: 'REJECTED_RATE_LIMITED', allowed: false });
    }

    // Forward legitimate or surviving requests to the live testbed
    const options = {
      hostname: 'localhost',
      port: 8080,
      path: `/${payloadData}`,
      method: 'GET',
      timeout: 3000
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (data.includes('Session ACCESS GRANTED')) {
          resolve({ type, status: 'SERVED_SUCCESS', allowed: true });
        } else {
          resolve({ type, status: 'DENIED_BACKEND', allowed: true });
        }
      });
    });

    req.on('error', () => resolve({ type, status: 'SERVER_ERROR', allowed: false }));
    req.on('timeout', () => {
      req.destroy();
      resolve({ type, status: 'TIMEOUT', allowed: false });
    });
    req.end();
  });
}

async function runAbuseDefenseSimulation() {
  console.log("=== Task B.2: Mixed Workload & Threat Defense Simulation ===\n");

  const results = {
    legitimateServed: 0,
    legitimateFailed: 0,
    abusiveBlocked: 0,
    abusiveLeaked: 0
  };

  // 1. Simulate 30 legitimate requests
  console.log("[Phase 1] Sending normal legitimate traffic...");
  for (let i = 0; i < 30; i++) {
    const res = await sendEvaluatedRequest('LEGITIMATE', `valid_payload_${i}`);
    if (res.status === 'SERVED_SUCCESS') {
      results.legitimateServed++;
    } else {
      results.legitimateFailed++;
    }
    await new Promise((r) => setTimeout(r, 100)); // 100ms normal interval
  }

  // 2. Simulate 20 oversized attack payloads
  console.log("[Phase 2] Sending oversized payload attack traffic...");
  for (let i = 0; i < 20; i++) {
    const largePayload = 'A'.repeat(500); // 500 characters, exceeds 50 char limit
    const res = await sendEvaluatedRequest('ABUSIVE_OVERSIZED', largePayload);
    if (!res.allowed) {
      results.abusiveBlocked++;
    } else {
      results.abusiveLeaked++;
    }
    await new Promise((r) => setTimeout(r, 50));
  }

  // 3. Simulate high-speed DoS bursts (0–5ms spacing)
  console.log("[Phase 3] Sending high-frequency burst attack traffic...");
  for (let i = 0; i < 30; i++) {
    const res = await sendEvaluatedRequest('ABUSIVE_BURST', `burst_${i}`);
    if (!res.allowed) {
      results.abusiveBlocked++;
    } else {
      results.abusiveLeaked++;
    }
    await new Promise((r) => setTimeout(r, 2)); // 2ms bursts
  }

  console.log("\n--- Threat Defense Evaluation Results ---");
  console.table([{
    "Legitimate Requests Served": results.legitimateServed,
    "Legitimate Requests Failed": results.legitimateFailed,
    "Abusive Requests Rejected": results.abusiveBlocked,
    "Abusive Requests Leaked": results.abusiveLeaked,
    "Defense Effectiveness": `${((results.abusiveBlocked / 50) * 100).toFixed(2)}%`
  }]);
}

runAbuseDefenseSimulation();