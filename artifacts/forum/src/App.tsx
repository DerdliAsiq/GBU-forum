import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ForumLayout } from "@/components/layout/ForumLayout";
import Home from "@/pages/Home";
import Category from "@/pages/Category";
import PostDetail from "@/pages/PostDetail";
import NewPost from "@/pages/NewPost";
import AdminPanel from "@/pages/admin/AdminPanel";
import Login from "@/pages/Login";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";
import Search from "@/pages/Search";
import Profile from "@/pages/Profile";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route>
        <ForumLayout>
          <Switch>
            <Route path="/" component={Home} />
            <Route path="/giris" component={Login} />
            <Route path="/category/:id" component={Category} />
            <Route path="/post/:id" component={PostDetail} />
            <Route path="/new-post" component={NewPost} />
            <Route path="/admin" component={AdminPanel} />
            <Route path="/settings" component={Settings} />
            <Route path="/axtaris" component={Search} />
            <Route path="/istifadeci/:username" component={Profile} />
            <Route component={NotFound} />
          </Switch>
        </ForumLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
