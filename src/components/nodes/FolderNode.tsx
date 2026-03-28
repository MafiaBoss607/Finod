import { Handle, Position } from '@xyflow/react';
import type { NodeProps } from '@xyflow/react';
import { Folder, FolderOpen, ChevronRight, ChevronDown } from 'lucide-react';

/**
 * FolderNode data shape:
 *  - label: string             — folder name
 *  - itemCount: number         — total files inside
 *  - expanded: boolean         — whether child nodes are visible on the canvas
 *  - childIds: string[]        — IDs of child nodes that belong to this folder
 *  - externalConnections: number — # of edges that connect a child to a node outside this folder (shown when collapsed)
 *  - children: ChildFileMeta[] — raw file metadata stored for expand/collapse
 */
export type ChildFileMeta = {
  name: string;
  extension: string;
  size: string;
};

export function FolderNode({ data, selected }: NodeProps) {
  const isExpanded = !!data.expanded;
  const externalConns = (data.externalConnections as number) || 0;

  return (
    <div
      className="glass-panel"
      style={{
        padding: '8px 10px',
        minWidth: '140px',
        maxWidth: '200px',
        border: selected
          ? '1px solid var(--node-border-selected)'
          : '1px solid var(--node-border)',
        boxShadow: selected ? 'var(--node-shadow-selected)' : 'none',
        transition: 'all 0.2s ease',
        fontSize: '12px',
        cursor: 'pointer',
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{ background: 'var(--color-folder)', width: '8px', height: '8px' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* Expand/Collapse chevron */}
        <div style={{ color: 'var(--text-muted)', lineHeight: 0, flexShrink: 0 }}>
          {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </div>

        {/* Icon */}
        <div
          style={{
            background: 'rgba(234,179,8,0.15)',
            padding: '5px',
            borderRadius: '6px',
            color: 'var(--color-folder)',
            lineHeight: 0,
            flexShrink: 0,
          }}
        >
          {isExpanded ? <FolderOpen size={14} /> : <Folder size={14} />}
        </div>

        {/* Label + meta */}
        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div
            style={{
              fontWeight: 500,
              color: 'var(--text-primary)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {String(data.label)}
          </div>
          <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
            {String(data.itemCount ?? 0)} items
            {!isExpanded && externalConns > 0 && (
              <span
                style={{
                  marginLeft: '6px',
                  background: 'var(--accent-primary)',
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '1px 5px',
                  fontSize: '9px',
                  fontWeight: 600,
                }}
              >
                {externalConns} linked
              </span>
            )}
          </div>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Right}
        style={{ background: 'var(--color-folder)', width: '8px', height: '8px' }}
      />
    </div>
  );
}
