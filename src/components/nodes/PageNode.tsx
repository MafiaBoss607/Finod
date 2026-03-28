import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { FileText } from 'lucide-react';

export function PageNode({ data, selected }: NodeProps) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '8px 10px',
        minWidth: '120px',
        maxWidth: '160px',
        border: selected ? '1px solid var(--node-border-selected)' : '1px solid var(--node-border)',
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'none',
        transition: 'all 0.2s ease',
        fontSize: '12px',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--color-page)', width: '8px', height: '8px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ background: 'rgba(168,85,247,0.15)', padding: '5px', borderRadius: '6px', color: 'var(--color-page)', lineHeight: 0 }}>
          <FileText size={14} />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
            Page {String(data.pageNumber)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {String(data.parentFile)}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: 'var(--color-page)', width: '8px', height: '8px' }} />
    </div>
  );
}
