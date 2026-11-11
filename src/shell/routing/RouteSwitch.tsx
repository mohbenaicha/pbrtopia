import type { ReactNode } from 'react';
import type { Route } from './router';

interface RouteViews<Section extends string> {
  list: ReactNode;
  project: (id: string) => ReactNode;
  settings: (section: Section) => ReactNode;
}

// Draws the view the route stands for.
export function RouteSwitch<Section extends string>({ route, views }: { route: Route<Section>; views: RouteViews<Section> }): React.JSX.Element {
  switch (route.view) {
    case 'list':
      return <>{views.list}</>;
    case 'project':
      return <>{views.project(route.id)}</>;
    case 'settings':
      return <>{views.settings(route.section)}</>;
  }
}
