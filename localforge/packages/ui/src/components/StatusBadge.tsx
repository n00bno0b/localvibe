import * as React from 'react';

export interface StatusBadgeProps {
    status: 'success' | 'warning' | 'error' | 'info' | 'neutral';
    label: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
    let color = '#ccc';
    let bg = 'rgba(255,255,255,0.1)';
    let border = '#444';

    switch (status) {
        case 'success':
            color = '#4CAF50';
            bg = 'rgba(76, 175, 80, 0.1)';
            border = 'rgba(76, 175, 80, 0.3)';
            break;
        case 'warning':
            color = '#FF9800';
            bg = 'rgba(255, 152, 0, 0.1)';
            border = 'rgba(255, 152, 0, 0.3)';
            break;
        case 'error':
            color = '#ff5555';
            bg = 'rgba(255, 85, 85, 0.1)';
            border = 'rgba(255, 85, 85, 0.3)';
            break;
        case 'info':
            color = 'cyan';
            bg = 'rgba(0, 255, 255, 0.1)';
            border = 'rgba(0, 255, 255, 0.3)';
            break;
    }

    return (
        <span style={{
            display: 'inline-block',
            padding: '2px 8px',
            borderRadius: '12px',
            fontSize: '10px',
            fontWeight: 'bold',
            textTransform: 'uppercase',
            color,
            backgroundColor: bg,
            border: `1px solid ${border}`
        }}>
            {label}
        </span>
    );
}
