# BreedSmart Product Context

## Product type

BreedSmart is an operational livestock-management application, not a marketing website.

## Users

### Farmer

Farmers manage their animals, submit service requests, report observations, review records, and receive updates.

### Technician

Technicians manage farmers, animals, AI services, pregnancy checks, calving, health assistance, tasks, appointments, and official records.

### Administrator

Administrators manage users, system configuration, records, reports, analytics, and operational oversight.

## Main workflows

- Farmer and animal management
- Artificial insemination requests and procedures
- Re-insemination attempts
- Farmer breeding observations
- Technician pregnancy diagnosis
- Continuation pregnancy rechecks
- Calving recording
- Health assistance
- Scheduling and visit management
- Notifications
- Reports and analytics

## Design goals

The interface should be:

- clear
- calm
- professional
- responsive
- accessible
- easy to scan
- suitable for operational field work

Preserve:

- BreedSmart green brand identity
- Outfit typography
- DaisyUI on web
- existing route structure
- existing Farmer, Technician, and Admin identity

Avoid:

- marketing-page layouts
- excessive animation
- decorative bento grids
- glassmorphism
- oversized empty hero sections
- unclear generic statuses
- excessive custom components when DaisyUI already provides a solution

## Product source of truth

Mobile Technician behavior is the current workflow source of truth when Web Technician behavior differs.

Backend domain and lifecycle services remain authoritative for validation and persistence.