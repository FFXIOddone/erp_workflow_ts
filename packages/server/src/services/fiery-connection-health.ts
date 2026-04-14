export interface FieryConnectionHealthInput {
  share: {
    accessible: boolean;
    writable: boolean;
    error?: string | null;
  };
  queue: {
    status: string;
    queueSize: number;
    raw?: string | null;
  };
  workflow: {
    outputChannelName: string | null;
    discoveredWorkflows: string[];
    discoveryError: string | null;
  };
  latestJob?: {
    stages: {
      key: string;
      label: string;
      complete: boolean;
    }[];
  } | null;
}

export interface FieryConnectionHealth {
  issue: boolean;
  stageKey: string | null;
  stageLabel: string;
  message: string;
}

function makeHealth(
  issue: boolean,
  stageKey: string | null,
  stageLabel: string,
  message: string,
): FieryConnectionHealth {
  return { issue, stageKey, stageLabel, message };
}

/**
 * Summarize Fiery connectivity and surface the exact stage that is failing or pending.
 * This keeps the diagnostics UI from collapsing everything into a generic "connected / issue"
 * badge when the real problem is the share, queue, workflow, or a specific JDF stage.
 */
export function buildFieryConnectionHealth(input: FieryConnectionHealthInput): FieryConnectionHealth {
  if (!input.share.accessible) {
    return makeHealth(
      true,
      'share',
      'File Share',
      input.share.error || 'Fiery file share is not accessible',
    );
  }

  if (!input.share.writable) {
    return makeHealth(
      true,
      'share',
      'File Share',
      input.share.error || 'Fiery file share is read-only',
    );
  }

  if (input.queue.status === 'Unreachable') {
    return makeHealth(true, 'queue', 'Queue', input.queue.raw || 'Fiery queue endpoint is unreachable');
  }

  if (!input.workflow.outputChannelName && input.workflow.discoveredWorkflows.length === 0) {
    return makeHealth(
      true,
      'workflow',
      'Workflow',
      input.workflow.discoveryError || 'No Fiery workflow could be discovered',
    );
  }

  const firstIncompleteStage = input.latestJob?.stages.find((stage) => !stage.complete);
  if (firstIncompleteStage) {
    return makeHealth(
      false,
      firstIncompleteStage.key,
      firstIncompleteStage.label,
      `Latest job waiting on ${firstIncompleteStage.label.toLowerCase()}`,
    );
  }

  return makeHealth(false, null, 'Healthy', 'Fiery connection looks healthy');
}
