import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { File } from 'lucide-react';

export function FileNode({ data, selected }: NodeProps) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '8px 10px',
        minWidth: '140px',
        maxWidth: '180px',
        border: selected ? '1px solid var(--node-border-selected)' : '1px solid var(--node-border)',
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'none',
        transition: 'all 0.2s ease',
        fontSize: '12px',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--color-file)', width: '8px', height: '8px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ background: 'rgba(59,130,246,0.15)', padding: '5px', borderRadius: '6px', color: 'var(--color-file)', lineHeight: 0 }}>
          <File size={14} />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {String(data.label)}
          </div>
          {!!data.extension && (
            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
              {String(data.extension)}{data.size ? ` • ${String(data.size)}` : ''}
            </div>
          )}
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: 'var(--color-file)', width: '8px', height: '8px' }} />
    </div>
  );
}
