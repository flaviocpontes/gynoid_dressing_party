## ADDED Requirements

### Requirement: Background interrogation jobs
Starting any interrogation (family pass, battery, re-ask, section re-run) SHALL enqueue a persisted job for the run and return to the user without waiting for inference. A job SHALL have a status of queued, running, done, or failed, and SHALL record its error when it fails. A separate worker process SHALL execute jobs one at a time, oldest first. At most one inference request SHALL be in flight across all jobs. When the worker starts, any job still marked running SHALL be returned to queued. Starting an interrogation while the run already has a queued or running job of the same kind SHALL NOT enqueue a duplicate.

#### Scenario: Battery returns immediately
- **WHEN** the user starts the battery for a run
- **THEN** the review page responds without waiting for any pass, showing the battery job as queued or running

#### Scenario: Jobs never overlap
- **WHEN** two runs each have a battery job queued
- **THEN** the second job starts only after the first has finished

#### Scenario: Crashed worker's job resumes
- **WHEN** the worker stops while a battery job is running and is then restarted
- **THEN** the job is queued again and, when it runs, executes only the passes that had not yet succeeded

#### Scenario: Duplicate start ignored
- **WHEN** the user clicks "run battery" twice while the first battery job is still queued
- **THEN** only one battery job exists for the run

#### Scenario: Unreachable server fails the job
- **WHEN** a battery job runs while the inference server is unreachable
- **THEN** the job is marked failed with an error naming the unreachable server, no pass rows are appended, and the review page shows the error

### Requirement: Live progress on the review surface
While a run has a queued or running job, the review surface SHALL update itself without user action. It SHALL show the job's status and each pass as soon as its row is stored. Updating SHALL stop once no job for the run is queued or running.

#### Scenario: Passes appear as they land
- **WHEN** a battery job has completed the heel pass but not the platform pass
- **THEN** the open review page shows the heel pass result and the platform pass as pending, without a manual reload

#### Scenario: Updating stops when idle
- **WHEN** the run's last job finishes
- **THEN** the review page shows the final state and stops refreshing

### Requirement: Worker availability notice
When a run's job has been queued for more than 15 seconds and no job is running, the review surface SHALL tell the user that the import worker appears to be stopped, and SHALL show the command that starts it.

#### Scenario: Worker not started
- **WHEN** the user starts a battery while no worker process is running, and 15 seconds pass
- **THEN** the review page shows that the worker appears to be stopped, with the command to start it
