import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { MessageSquare } from 'lucide-react';

export function CommentNode({ data, selected }: NodeProps) {
  const comment = String(data.comment || '');
  // Show first ~120 chars truncated
  const preview = comment.length > 120 ? comment.slice(0, 120) + '…' : comment;

  return (
    <div
      className="glass-panel"
      style={{
        padding: '10px 12px',
        minWidth: '180px',
        maxWidth: '260px',
        borderLeft: '3px solid var(--color-comment)',
        border: selected
          ? '1px solid var(--node-border-selected)'
          : '1px solid var(--node-border)',
        borderLeftWidth: '3px',
        borderLeftColor: 'var(--color-comment)',
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'none',
        transition: 'all 0.2s ease',
        fontSize: '12px',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'var(--color-comment)', width: '8px', height: '8px' }}
      />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
        {/* Icon */}
        <div
          style={{
            background: 'rgba(249,115,22,0.15)',
            padding: '5px',
            borderRadius: '6px',
            color: 'var(--color-comment)',
            lineHeight: 0,
            flexShrink: 0,
            marginTop: '1px',
          }}
        >
          <MessageSquare size={14} />
        </div>

        {/* Content */}
        <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 500,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              marginBottom: '3px',
            }}
          >
            {String(data.label || 'Comment')}
          </div>
          {preview && (
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                lineHeight: '1.4',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                wordBreak: 'break-word',
              }}
            >
              {preview}
            </div>
          )}
          {!preview && (
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
              No comment yet
            </div>
          )}
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'var(--color-comment)', width: '8px', height: '8px' }}
      />
    </div>
  );
}
