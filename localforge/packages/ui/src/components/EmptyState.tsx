import * as React from 'react';

export interface EmptyStateProps {
    iconClass: string;
    title: string;
    description: string;
    action?: React.ReactNode;
}

export function EmptyState({ iconClass, title, description, action }: EmptyStateProps) {
    return (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#888' }}>
            <i className={`fa ${iconClass}`} style={{ fontSize: '32px', color: '#555', marginBottom: '15px' }} />
            <h3 style={{ margin: '0 0 10px 0', color: '#ccc' }}>{title}</h3>
            <p style={{ fontSize: '12px', margin: '0 0 20px 0' }}>{description}</p>
            {action && <div>{action}</div>}
        </div>
    );
}
