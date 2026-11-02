import { Tab, TabList, TabPanel, TabPanels, Tabs } from '@carbon/react';
import type { ReactNode } from 'react';
import { PageHeader, type Crumb } from './PageHeader.js';

interface DetailPageProps {
  breadcrumbs?: Crumb[];
  title: string;
  actions?: ReactNode;
  summary: ReactNode;
  tabs: { label: string; content: ReactNode }[];
}

// One record: read-only summary tiles above, its sections in tabs below.
export function DetailPage({ breadcrumbs, title, actions, summary, tabs }: DetailPageProps) {
  return (
    <div className="tenantry-page">
      <PageHeader breadcrumbs={breadcrumbs} title={title} actions={actions} />
      <div className="tenantry-page__summary">{summary}</div>
      <Tabs>
        <TabList aria-label={`${title} sections`}>
          {tabs.map((tab) => (
            <Tab key={tab.label}>{tab.label}</Tab>
          ))}
        </TabList>
        <TabPanels>
          {tabs.map((tab) => (
            <TabPanel key={tab.label}>{tab.content}</TabPanel>
          ))}
        </TabPanels>
      </Tabs>
    </div>
  );
}
