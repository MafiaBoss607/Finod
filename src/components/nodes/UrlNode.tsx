import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Link2 } from 'lucide-react';

export function UrlNode({ data, selected }: NodeProps) {
  return (
    <div
      className="glass-panel"
      style={{
        padding: '8px 10px',
        minWidth: '140px',
        maxWidth: '190px',
        border: selected ? '1px solid var(--node-border-selected)' : '1px solid var(--node-border)',
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'none',
        transition: 'all 0.2s ease',
        fontSize: '12px',
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: 'var(--color-url)', width: '8px', height: '8px' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <div style={{ background: 'rgba(16,185,129,0.15)', padding: '5px', borderRadius: '6px', color: 'var(--color-url)', lineHeight: 0 }}>
          <Link2 size={14} />
        </div>
        <div style={{ overflow: 'hidden' }}>
          <div style={{ fontWeight: 500, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {String(data.label)}
          </div>
          <a
            href={String(data.url)}
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '10px', color: 'var(--accent-hover)', textDecoration: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', display: 'block' }}
          >
            {String(data.url)}
          </a>
        </div>
      </div>

      <Handle type="source" position={Position.Right} style={{ background: 'var(--color-url)', width: '8px', height: '8px' }} />
    </div>
  );
}
