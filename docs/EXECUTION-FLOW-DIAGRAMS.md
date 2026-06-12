# pi-spine Execution Flow Diagrams

This document contains visual diagrams that complement `EXECUTION-FLOW.md`.

---

## 1. System Architecture

```mermaid
flowchart TD
    subgraph CLI["CLI Layer (bin/spine.mjs)"]
        C1[spine batch start]
        C2[spine batch resume]
        C3[spine plan all]
        C4[spine status]
        C5[spine preflight]
    end

    subgraph Engine["Engine Layer (src/batch/)"]
        E1[startBatch]
        E2[resumeBatch]
        E3[runWorker]
        E4[mergeLaneToOrch]
        E5[diagnoseBatch]
    end

    subgraph LaneEngine["Lane Engine (engine-lanes.mjs)"]
        L1[Queue tasks]
        L2[Assign lanes]
        L3[Track progress]
        L4[Commit worktree]
    end

    subgraph Worker["Worker Host (worker-host.mjs)"]
        W1[spawn pi agent]
        W2[poll progress]
        W3[heartbeat logging]
        W4[stall detection]
    end

    subgraph Review["Review Engine (review.mjs)"]
        R1[Code review]
        R2[Final review]
        R3[Contract verify]
    end

    subgraph Git["Git Infrastructure"]
        G1[Orch branch]
        G2[Lane branches]
        G3[Worktrees]
    end

    subgraph Data["Data Layer"]
        D1[Batch state]
        D2[Journal events]
        D3[Metrics]
    end

    CLI --> Engine
    Engine --> LaneEngine
    Engine --> Worker
    Engine --> Review
    Engine --> Git
    Engine --> Data

    Worker --> Review
    LaneEngine --> Worker
    LaneEngine --> Git
    Review --> Git
```

---

## 2. Batch Lifecycle State Machine

```mermaid
stateDiagram-v2
    [*] --> planning: spine init\nspine plan all

    planning --> running: spine batch start\nphase: planning → running

    running --> running: heartbeat\nworker progress

    running --> merging: wave complete\nstart lane merge

    merging --> running: lane merge complete\nnext wave

    running --> paused: spine batch pause\nphase: running → paused

    paused --> running: spine batch resume\nphase: paused → running

    running --> failed: task failure\nmixed outcome

    failed --> failed: retry attempt\nresume

    running --> completed: all waves complete\nall tasks success

    completed --> [*]: batch complete

    failed --> aborted: spine batch abort

    aborted --> [*]: batch dismiss

    running --> aborted: hard timeout\nSIGKILL
```

---

## 3. Task Execution Sequence

```mermaid
sequenceDiagram
    participant E as Engine
    participant L as Lane Engine
    participant W as Worker Host
    participant P as pi agent
    participant R1 as Code Review
    participant R2 as Final Review
    participant G as Git

    E->>L: startWave(waveIndex)
    L->>L: assignTasksToTicks()
    
    loop for each tick
        L->>W: runWorker(lane1)
        L->>W: runWorker(lane2)
        
        W->>P: spawn pi -p PROMPT.md
        activate P
        
        loop polling (every 5s)
            P-->>W: progress signals
            W->>W: heartbeat logging
            W->>W: stall check
        end
        
        P-->>W: .DONE created
        deactivate P
        
        W-->>L: workerResult
        L->>R1: runCodeReview()
        
        alt reviewLevel >= 2
            R1->>R1: check APPROVE/REVISE
            R1->>R1: if REVISE: remove .DONE
            R1->>W: runWorker() [rework]
        end
        
        L->>R2: runFinalReview()
        
        alt reviewLevel >= 1
            R2->>R2: contract verification
            R2->>R2: check PASS/REVISE/REPLAN
            R2->>R2: if REVISE: remove .DONE
            R2->>W: runWorker() [rework]
        end
        
        L->>G: commitLaneWorktree()
        G->>G: git add .
        G->>G: git commit -m "SP-001: ... [skip-spine]"
        L->>L: record success
        
        Note over L: append journal event
        L->>E: lane.completed
    end
    
    E->>L: mergeWaveLanesToOrch()
    L->>G: git merge task/spine-lane-1
    L->>G: git merge task/spine-lane-2
    E->>E: record merge results
```

---

## 4. Wave and Tick Scheduling

```mermaid
flowchart TD
    subgraph Wave0["Wave 0 (no deps)"]
        T0[SP-001]
    end
    
    subgraph Wave1["Wave 1 (depends on Wave 0)"]
        T1[SP-002]
        T2[SP-003]
        T3[SP-004]
    end
    
    subgraph Wave2["Wave 2 (depends on Wave 1)"]
        T4[SP-005]
    end
    
    Wave0 --> Wave1
    Wave1 --> Wave2
    
    subgraph Tick1["Tick 1 (maxParallel=2)"]
        L1[Lane 1: SP-002]
        L2[Lane 2: SP-003]
    end
    
    subgraph Tick2["Tick 2 (queue excess)"]
        L3[Lane 1: SP-004]
    end
    
    Wave1 --> Tick1
    Wave1 --> Tick2
    
    style Tick1 fill:#90EE90
    style Tick2 fill:#87CEEB
```

---

## 5. Review Loop Flow

```mermaid
flowchart TD
    Start[Worker creates .DONE] --> CodeCheck{reviewLevel >= 2?}
    
    CodeCheck -->|No| FinalCheck{reviewLevel >= 1?}
    CodeCheck -->|Yes| CodeReview[Run Code Review]
    
    CodeReview --> CodeVerdict{Verdict?}
    CodeVerdict -->|APPROVE| FinalCheck
    CodeVerdict -->|REVISE| CodeRework[Remove .DONE]
    CodeRework --> CodeRetry[Run worker again]
    CodeRetry --> CodeReview
    
    FinalCheck -->|No| Success[Task complete]
    FinalCheck -->|Yes| FinalReview[Run Final Review]
    
    FinalReview --> ContractCheck{Contract verify?}
    ContractCheck -->|Yes| ContractTest[Run tests]
    ContractTest --> ContractResult{Pass?}
    ContractResult -->|No| FinalRework[Mark REVISE]
    ContractResult -->|Yes| FinalVerdict{Verdict?}
    
    FinalVerdict -->|PASS| Success
    FinalVerdict -->|REVISE| FinalRework
    FinalVerdict -->|REPLAN| FailReplan[Mark needs_replan]
    
    FinalRework --> FinalRetry[Remove .DONE]
    FinalRetry --> FinalWorker[Run worker again]
    FinalWorker --> FinalReview
```

---

## 6. Error Recovery Flow

```mermaid
flowchart TD
    Start[Worker fails] --> Classify{Classification?}
    
    Classify -->|failed| RetryCheck{retry count < max?}
    RetryCheck -->|Yes| Retry[Rename .DONE, retry]
    Retry --> WorkerLoop[Run worker again]
    
    RetryCheck -->|No| FailTask[Mark task failed]
    
    Classify -->|stall_timeout| StallCheck{progress recently?}
    StallCheck -->|Yes| SoftKill[Send SIGTERM]
    SoftKill --> WaitGrace[Wait grace period]
    WaitGrace --> HardKill[Send SIGKILL]
    HardKill --> FailTask
    
    StallCheck -->|No| FailTask
    
    Classify -->|aborted| AbortArchive[Archive state]
    AbortArchive --> Dismiss[Batch dismiss]
    
    Classify -->|orphan_salvaged| Salvage[Auto-success]
    Salvage --> WorkerLoop
    
    FailTask --> WaveCheck{All tasks in wave done?}
    WaveCheck -->|No| BatchFail[Batch phase: failed]
    WaveCheck -->|Yes| MergeOrch[Merge to orch]
    
    BatchFail --> Recovery[Recovery options:]
    Recovery --> RetryCmd[spine batch retry]
    Recovery --> SkipCmd[spine batch skip]
    Recovery --> AbortCmd[spine batch abort]
```

---

## 7. Pause and Resume Flow

```mermaid
flowchart TD
    subgraph RunningState["Running State"]
        R1[Workers executing]
        R2[Tasks in progress]
    end
    
    subgraph PausedState["Paused State"]
        P1[No new tasks]
        P2[Workers allowed to finish]
    end
    
    R1 --> Pause[spine batch pause]
    Pause --> P1
    
    P1 --> Resume[spine batch resume]
    Resume --> R1
    
    pause_resume_both -->|multi-task| MultiResume[Resume all lanes in parallel]
    pause_resume_both -->|single-task| SingleResume[Resume from checkpoint]
    
    style RunningState fill:#90EE90
    style PausedState fill:#87CEEB
```

---

## 8. Integration Gate Flow

```mermaid
flowchart TD
    subgraph BatchComplete["Batch Complete"]
        BC1[All waves merged]
        BC2[Orch branch up to date]
    end
    
    BC1 --> GateCheck{Gate required?}
    
    GateCheck -->|No| AutoIntegrate[Auto-integrate]
    GateCheck -->|Yes| GateInspect[spine gate status]
    
    GateInspect --> ReviewEvidence[Review evidence:]
    ReviewEvidence --> E1[summary.md]
    ReviewEvidence --> E2[diff-stat.txt]
    ReviewEvidence --> E3[test output]
    
    E1 --> GateDecision{Approve?}
    E2 --> GateDecision
    E3 --> GateDecision
    
    GateDecision -->|Yes| GateApprove[spine gate approve]
    GateDecision -->|No| GateReject[spine gate reject]
    
    GateApprove --> Integrate[spine integrate]
    Integrate --> GitMerge[git merge --no-ff]
    GitMerge --> BatchArchive[Batch complete]
    
    GateReject --> BatchRetain[Batch remain active]
```

---

## 9. Journal Event Timeline

```mermaid
timeline
    title Batch Event Timeline (20260612T143000)
    
    batch.started : 14:30:00
    lane.provisioned : 14:30:01
    lane.setup_hook.started : 14:30:02
    lane.setup_hook.completed : 14:30:03
    task.started : 14:30:05
    task.step_started : 14:30:10
    task.step_completed : 14:35:00
    task.step_started : 14:35:05
    task.step_completed : 14:40:00
    lane.completed : 14:40:05
    code_review.started : 14:40:10
    code_review.completed : 14:42:00
    final_review.started : 14:42:05
    contract.verified : 14:42:10
    final_review.completed : 14:45:00
    lane.committed : 14:45:05
    task.completed : 14:45:10
    batch.merge_started : 14:45:15
    batch.merge_completed : 14:45:20
    integrate.started : 14:45:25
    integrate.completed : 14:45:30
    batch.completed : 14:45:35
```

---

## 10. Git Branch Strategy

```mermaid
graph LR
    subgraph Repo["Repository"]
        Main[main / base] --> Orch[orch/spine-20260612T143000]
        Orch --> Lane1[task/spine-lane-1-20260612T143000]
        Orch --> Lane2[task/spine-lane-2-20260612T143000]
    end
    
    subgraph Worktrees["Worktrees"]
        WT1[.worktrees/lane-1] --> Lane1
        WT2[.worktrees/lane-2] --> Lane2
    end
    
    Main -.->|git checkout -b| Orch
    Orch -.->|git worktree add| WT1
    Orch -.->|git worktree add| WT2
    
    Lane1 -.->|git merge| Orch
    Lane2 -.->|git merge| Orch
    
    style Main fill:#90EE90
    style Orch fill:#87CEEB
    style Lane1 fill:#87CEEB
    style Lane2 fill:#87CEEB
```

---

*These diagrams visualize the execution flow documented in `EXECUTION-FLOW.md`.*
