import type { Node } from '@xyflow/react';

type PropertiesPanelProps = {
  selectedNode: Node | null;
  onUpdateNode: (id: string, data: any) => void;
};

export function PropertiesPanel({ selectedNode, onUpdateNode }: PropertiesPanelProps) {
  if (!selectedNode) {
    return (
      <div 
        className="glass-panel" 
        style={{ 
          width: '280px', 
          height: 'calc(100vh - 40px)', 
          margin: '20px 20px 20px 0', 
          padding: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10,
          position: 'absolute',
          top: 0,
          right: 0,
        }}
      >
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', textAlign: 'center' }}>
          Select a node to edit its properties
        </p>
      </div>
    );
  }

  const handleChange = (key: string, value: string | number) => {
    onUpdateNode(selectedNode.id, { [key]: value });
  };

  return (
    <div 
      className="glass-panel" 
      style={{ 
        width: '280px', 
        height: 'calc(100vh - 40px)', 
        margin: '20px 20px 20px 0', 
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        zIndex: 10,
        position: 'absolute',
        top: 0,
        right: 0,
      }}
    >
      <div style={{ paddingBottom: '16px', borderBottom: '1px solid var(--panel-border)' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', textTransform: 'capitalize' }}>
          {selectedNode.type} Node Info
        </h2>
        <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          ID: {selectedNode.id}
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Label (Common for most) */}
        {selectedNode.type !== 'page' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Name / Label</label>
            <input 
              type="text" 
              value={(selectedNode.data.label as string) || ''} 
              onChange={(e) => handleChange('label', e.target.value)}
              style={{
                background: 'var(--node-bg)',
                border: '1px solid var(--node-border)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                outline: 'none',
                width: '100%',
                fontSize: '14px'
              }}
            />
          </div>
        )}

        {/* File specific properties */}
        {selectedNode.type === 'file' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Extension</label>
              <input 
                type="text" 
                value={(selectedNode.data.extension as string) || ''} 
                onChange={(e) => handleChange('extension', e.target.value)}
                style={{
                  background: 'var(--node-bg)',
                  border: '1px solid var(--node-border)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: '100%',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Size</label>
              <input 
                type="text" 
                value={(selectedNode.data.size as string) || ''} 
                onChange={(e) => handleChange('size', e.target.value)}
                style={{
                  background: 'var(--node-bg)',
                  border: '1px solid var(--node-border)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: '100%',
                  fontSize: '14px'
                }}
              />
            </div>
          </>
        )}

        {/* URL specific properties */}
        {selectedNode.type === 'url' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Direct URL</label>
            <input 
              type="text" 
              value={(selectedNode.data.url as string) || ''} 
              onChange={(e) => handleChange('url', e.target.value)}
              style={{
                background: 'var(--node-bg)',
                border: '1px solid var(--node-border)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                outline: 'none',
                width: '100%',
                fontSize: '14px'
              }}
            />
          </div>
        )}

        {/* Folder specific properties */}
        {selectedNode.type === 'folder' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Item Count</label>
            <input 
              type="number" 
              value={(selectedNode.data.itemCount as number) || 0} 
              onChange={(e) => handleChange('itemCount', parseInt(e.target.value, 10) || 0)}
              style={{
                background: 'var(--node-bg)',
                border: '1px solid var(--node-border)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                outline: 'none',
                width: '100%',
                fontSize: '14px'
              }}
            />
          </div>
        )}

        {/* Page specific properties */}
        {selectedNode.type === 'page' && (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Page Number</label>
              <input 
                type="number" 
                value={(selectedNode.data.pageNumber as number) || 1} 
                onChange={(e) => handleChange('pageNumber', parseInt(e.target.value, 10) || 1)}
                style={{
                  background: 'var(--node-bg)',
                  border: '1px solid var(--node-border)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: '100%',
                  fontSize: '14px'
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Parent File Name</label>
              <input 
                type="text" 
                value={(selectedNode.data.parentFile as string) || ''} 
                onChange={(e) => handleChange('parentFile', e.target.value)}
                style={{
                  background: 'var(--node-bg)',
                  border: '1px solid var(--node-border)',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  outline: 'none',
                  width: '100%',
                  fontSize: '14px'
                }}
              />
            </div>
          </>
        )}

        {/* Comment specific properties */}
        {selectedNode.type === 'comment' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-muted)' }}>Comment Text</label>
            <textarea 
              value={(selectedNode.data.comment as string) || ''} 
              onChange={(e) => handleChange('comment', e.target.value)}
              placeholder="Write your comment here…"
              rows={6}
              style={{
                background: 'var(--node-bg)',
                border: '1px solid var(--node-border)',
                borderRadius: '6px',
                padding: '8px 12px',
                color: 'var(--text-primary)',
                outline: 'none',
                width: '100%',
                fontSize: '13px',
                resize: 'vertical',
                fontFamily: 'inherit',
                lineHeight: '1.5',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
