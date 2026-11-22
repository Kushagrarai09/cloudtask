# Infrastructure notes

The CDK stack creates stage-suffixed resources in the configured AWS account and region. The default region is `ap-south-1` (Mumbai). The sample EventBridge rule is intentionally disabled; enable it after reviewing its schedule and payload. The Step Functions state machine is a minimal orchestration example and should be extended with retries, catches, wait states, and explicit business steps for a real workflow.
