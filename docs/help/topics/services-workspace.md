### Overview
Track service lifecycle, risk, renewals, and replacement posture.

### Toolbar
- Search by service/vendor/owner
- Vendor filter
- Risk filter
- Risk filter is useful when prioritizing review work instead of scanning the full service inventory.

### Table actions
- Review
- Edit
- Open contract
- Open alert
- Open replacement
- Delete

### Detail tabs
- Overview
- Expenses
- Contracts
- Renewals
- Replacement Plan
- Read the tabs from left to right when learning a service: what it is, what it costs, what it is contracted through, when it renews, and whether it has a replacement path.

### Create/Edit Service form
- Service name
- Vendor
- Owner
- Annual spend (minor units)
- Status (`active`, `trial`, `deprecated`, `retiring`, `retired`)
- Risk (`low`, `medium`, `high`)
- Replacement status (`not-started`, `candidate-review`, `approved`)

### Service field guidance
- Service name:
  - Use the product or capability name your team uses operationally.
  - Example: `Identity SSO` or `Cloud Platform`.
- Vendor:
  - Link the service to the supplier responsible for the product or hosted platform.
  - If the vendor is unknown, create/confirm the vendor record first so service reporting stays coherent.
- Owner:
  - Use the accountable team or function, not a rotating individual contributor whenever possible.
- Annual spend (minor units):
  - Store the annualized spend amount in minor units.
  - Example: `120000` means `$1,200.00`.
- Status:
  - `active`: normal live service.
  - `trial`: being evaluated, not yet part of standard operations.
  - `deprecated`: still present but should not be expanded.
  - `retiring`: active exit is underway.
  - `retired`: no longer in use.
  - New-user default: choose `active` unless the service is clearly in evaluation or retirement.
- Risk:
  - Use this for service-level concern, not just vendor sentiment.
  - `low`: stable ownership, acceptable lifecycle posture, no pressing renewal or reliability concern.
  - `medium`: some material concern exists and should stay visible in review.
  - `high`: active operational, security, cost, or lifecycle concern requiring prioritized action.
  - If uncertain, choose `medium` first.
- Replacement status:
  - `not-started`: no formal replacement work has begun.
  - `candidate-review`: alternatives are being evaluated.
  - `approved`: a replacement direction is agreed and execution planning can proceed.
  - Do not set `approved` just because the current service is unpopular; use it only when a real replacement direction has been accepted.

### Worked example
- Situation:
  - You run a central identity platform used by most employees.
- Reasonable first record:
  - Service name = `Identity SSO`
  - Vendor = `Okta`
  - Owner = `IT Operations`
  - Annual spend = annualized contract estimate
  - Status = `active`
  - Risk = `medium`
  - Replacement status = `not-started`
- Why:
  - The service is clearly live.
  - It is important enough that some level of risk visibility is warranted.
  - There is no approved replacement yet, so replacement should not be overstated.

### Safety action
- Delete confirmation dialog
- Delete only mistaken or duplicate service records.
- If a service is real but winding down, prefer lifecycle/status changes over deletion so history stays intact.
