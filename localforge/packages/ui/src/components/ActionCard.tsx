import * as React from 'react';

export interface ActionCardProps {
    title: string;
    description?: React.ReactNode;
    iconClass?: string;
    borderColor?: string;
    onClick?: () => void;
    children?: React.ReactNode;
}

export function ActionCard({ title, description, iconClass, borderColor = '#444', onClick, children }: ActionCardProps) {
    return (
        <div
            onClick={onClick}
            style={{
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${borderColor}`,
                borderLeft: `4px solid ${borderColor === '#444' ? '#007acc' : borderColor}`,
                padding: '10px',
                marginBottom: '10px',
                borderRadius: '4px',
                cursor: onClick ? 'pointer' : 'default'
            }}
        >
            <h3 style={{ margin: '0 0 5px 0', fontSize: '14px', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
                {iconClass && <i className={`fa ${iconClass}`} />}
                {title}
            </h3>
            {description && <div style={{ fontSize: '12px', color: '#ccc', marginBottom: children ? '10px' : '0' }}>{description}</div>}
            {children && <div>{children}</div>}
        </div>
    );
}
