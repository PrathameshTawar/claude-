# MONARCH SYNTHETIC INCIDENT POST-MORTEM (INC-042)

- **Incident ID**: INC-042
- **Title**: Checkout Failures Following Release v2.4 Deployment
- **Severity**: P1 - Critical Outage
- **Time of Detection**: 2026-09-17 14:15 UTC
- **Impacted Subsystem**: Monarch Checkout API Gateway & Payment Processing

---

## 1. Executive Overview
At 14:08 UTC on 2026-09-17, customer checkout transactions began failing with HTTP 500 errors across production region `prod-useast1`. Preliminary triage initially raised hypotheses regarding network routing failures or upstream provider outages. Subsequent forensic analysis confirmed the root cause was database connection pool exhaustion caused by a pool misconfiguration in deployment v2.4.

---

## 2. Timeline of Key Events
- **14:02 UTC**: Deployment v2.4 completed. Rolling update deployed 8 instances of `checkout-service`. Migration #847 updated database pool settings.
- **14:04 UTC**: Database connection count climbed rapidly from baseline 12 to 38 active connections.
- **14:07 UTC**: Database connection pool reached hard limit of 50 connections (Page 5). PostgreSQL emitted fatal errors: `remaining connection slots are reserved`.
- **14:08 UTC**: Checkout API requests began timing out with `ConnectionPoolTimeoutException` at line 18392 of `application.log`.
- **14:15 UTC**: Automated metric alerts triggered PagerDuty incident INC-042.

---

## 3. Findings & Contradiction Audit
- **Network Team Assessment**: Network telemetry confirmed normal latencies (<2ms) and zero packet loss between application pods and database nodes, disproving the initial network outage hypothesis.
- **Root Cause**: Deployment v2.4 constrained `max_pool_size=50` with `max_overflow=0`, while 8 pods running 8 worker threads each required up to $8 \times 8 = 64$ connections under peak load.

---

## 4. Remediation Steps
1. Reverted database connection configuration to `max_pool_size=100` and `max_overflow=20`.
2. Restarted `checkout-service` pods.
3. Added automated connection pool monitoring alerts in CloudWatch.
