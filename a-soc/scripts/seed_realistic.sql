INSERT INTO events (id, timestamp, event_type, agent, payload, signature, trace_id, incident_id)
SELECT
  gen_random_uuid(),
  NOW() - (g * (INTERVAL '1 hour' * (1 + random() * 23))),
  e.etype,
  e.agent,
  jsonb_build_object('severity', e.sev, 'source', e.src, 'description', e.descr),
  md5(random()::text),
  'trace-' || md5(random()::text),
  ''
FROM generate_series(0, 19) AS g
CROSS JOIN (VALUES
  ('network_intrusion', 'DetectionAgent', 'high', 'IDS', 'Detected port scan from 185.220.101.42'),
  ('auth_failure', 'TelemetryAgent', 'medium', 'SSO', 'Failed login attempt for admin@corp.local'),
  ('malware_detection', 'ForensicsAgent', 'critical', 'EDR', 'Trojan.GenericKD.46832178 quarantined'),
  ('data_exfiltration', 'ResponseAgent', 'high', 'DLP', 'Sensitive file uploaded to personal cloud storage'),
  ('privilege_escalation', 'DetectionAgent', 'critical', 'SIEM', 'User promoted to Domain Admin without approval'),
  ('dns_anomaly', 'TelemetryAgent', 'medium', 'DNS', 'High-entropy DNS queries to suspicious domain'),
  ('firewall_block', 'ResponseAgent', 'low', 'FW', 'Outbound connection to known malicious IP blocked'),
  ('vulnerability_scan', 'ComplianceAgent', 'medium', 'Scanner', 'Critical CVE found on web-server-03'),
  ('config_change', 'ComplianceAgent', 'low', 'ConfigMgr', 'Security group rule modified on SG-PROD'),
  ('api_abuse', 'DetectionAgent', 'high', 'API-GW', 'Rate limit exceeded on /api/auth endpoint'),
  ('container_escape', 'ForensicsAgent', 'critical', 'K8s', 'Container breakout attempt detected in prod namespace'),
  ('credential_stuffing', 'DetectionAgent', 'high', 'WAF', 'Credential stuffing attack on login portal'),
  ('crypto_mining', 'TelemetryAgent', 'medium', 'EDR', 'Cryptominer process detected on GPU instance'),
  ('lateral_movement', 'ForensicsAgent', 'critical', 'EDR', 'PsExec execution chain across 5 hosts'),
  ('phishing_click', 'NotificationAgent', 'high', 'Email', 'User clicked malicious link in phishing email'),
  ('ransomware_note', 'ResponseAgent', 'critical', 'EDR', 'Ransomware note file detected on share'),
  ('sql_injection', 'DetectionAgent', 'high', 'WAF', 'SQL injection attempt on /api/v2/search'),
  ('ssh_brute_force', 'TelemetryAgent', 'medium', 'Auth', '50 failed SSH attempts in 5 minutes'),
  ('tls_cert_expired', 'ComplianceAgent', 'low', 'CertMgr', 'Internal TLS certificate expired for staging API'),
  ('s3_public_acl', 'ComplianceAgent', 'medium', 'CloudSec', 'S3 bucket backup-prod made public')
) AS e(etype, agent, sev, src, descr)
WHERE NOT EXISTS (SELECT 1 FROM events LIMIT 1);
