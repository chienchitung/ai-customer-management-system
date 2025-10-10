import React, { useMemo } from 'react';
import { Customer, CustomerStatus } from '../types';
import { statusColors } from './CustomerDashboard';
import { t, translateStatus } from '../localization';


interface AnalyticsDashboardProps {
    customers: Customer[];
    language: 'en' | 'zh';
}

const StatCard: React.FC<{ title: string; value: string | number; description?: string }> = ({ title, value, description }) => (
    <div className="bg-surface p-6 rounded-lg border border-border">
        <h3 className="text-sm font-medium text-text-secondary">{title}</h3>
        <p className="text-3xl font-bold mt-1 text-text-primary">{value}</p>
        {description && <p className="text-xs text-text-secondary mt-2">{description}</p>}
    </div>
);

const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({ customers, language }) => {

    const stats = useMemo(() => {
        const totalCustomers = customers.length;
        
        const openDeals = customers.filter(c => 
            c.status !== CustomerStatus.CLOSED_WON && c.status !== CustomerStatus.CLOSED_LOST
        );

        const pipelineValue = openDeals.reduce((sum, c) => sum + (c.dealValue || 0), 0);
        
        const customersWithDealValue = customers.filter(c => typeof c.dealValue === 'number');
        const avgDealValue = customersWithDealValue.length > 0 
            ? customersWithDealValue.reduce((sum, c) => sum + (c.dealValue || 0), 0) / customersWithDealValue.length
            : 0;

        const customersByStatus = Object.values(CustomerStatus).map(status => ({
            status,
            count: customers.filter(c => c.status === status).length,
        }));
        
        return {
            totalCustomers,
            pipelineValue,
            avgDealValue,
            customersByStatus,
        };
    }, [customers]);

    const maxCountInFunnel = Math.max(...stats.customersByStatus.map(s => s.count), 0);

    return (
        <div>
            <h2 className="text-xl font-semibold mb-4">{t('performanceDashboard', language)}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard 
                    title={t('totalCustomers', language)} 
                    value={stats.totalCustomers} 
                    description={t('totalCustomersDesc', language)}
                />
                <StatCard 
                    title={t('pipelineValue', language)} 
                    value={`$${stats.pipelineValue.toLocaleString()}`} 
                    description={t('pipelineValueDesc', language)} 
                />
                <StatCard 
                    title={t('avgDealValue', language)} 
                    value={`$${Math.round(stats.avgDealValue).toLocaleString()}`} 
                    description={t('avgDealValueDesc', language)} 
                />
            </div>

            <div className="mt-8 bg-surface p-6 rounded-lg border border-border">
                <h3 className="text-lg font-semibold mb-4">{t('salesFunnel', language)}</h3>
                <div className="space-y-4">
                    {stats.customersByStatus.map(({ status, count }) => (
                        <div key={status} className="flex items-center gap-4">
                            <div className="w-36 text-right text-sm font-medium text-text-secondary flex-shrink-0">{translateStatus(status, language)}</div>
                            <div className="flex-grow bg-secondary/30 rounded-full h-8">
                                <div
                                    className={`h-8 rounded-full flex items-center px-3 text-sm font-bold transition-all duration-500 ${statusColors[status].text} ${statusColors[status].bg}`}
                                    style={{ width: maxCountInFunnel > 0 ? `${(count / maxCountInFunnel) * 100}%` : '0%' }}
                                >
                                    {count > 0 ? count : ''}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AnalyticsDashboard;