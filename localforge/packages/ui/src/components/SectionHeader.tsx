import * as React from 'react';

export interface SectionHeaderProps {
    title: string;
    description?: string;
    rightContent?: React.ReactNode;
}

export function SectionHeader({ title, description, rightContent }: SectionHeaderProps) {
    return (
        <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h2 style={{ margin: '0 0 5px 0', fontSize: '18px', color: 'white' }}>{title}</h2>
                {rightContent && <div>{rightContent}</div>}
            </div>
            {description && <p style={{ margin: 0, color: '#ccc', fontSize: '12px' }}>{description}</p>}
        </div>
    );
}
