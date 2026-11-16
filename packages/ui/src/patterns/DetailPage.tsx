import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/tabs.js';
import type { IconComponent } from '../icon.js';
import { Page } from './page.js';
import { PageHeader, type Crumb } from './PageHeader.js';

interface DetailPageProps {
  breadcrumbs?: Crumb[];
  title: string;
  icon?: IconComponent;
  description?: ReactNode;
  actions?: ReactNode;
  summary: ReactNode;
  tabs: { label: string; content: ReactNode }[];
}

// One record: read-only summary tiles above, its sections in tabs below.
export function DetailPage({ breadcrumbs, title, icon, description, actions, summary, tabs }: DetailPageProps) {
  return (
    <Page>
      <PageHeader breadcrumbs={breadcrumbs} title={title} icon={icon} description={description} actions={actions} />
      <div>{summary}</div>
      <Tabs defaultValue={tabs[0]?.label}>
        <TabsList aria-label={`${title} sections`}>
          {tabs.map((tab) => (
            <TabsTrigger key={tab.label} value={tab.label}>
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((tab) => (
          <TabsContent key={tab.label} value={tab.label}>
            {tab.content}
          </TabsContent>
        ))}
      </Tabs>
    </Page>
  );
}
