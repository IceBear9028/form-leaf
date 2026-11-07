import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cn } from "cn";

const Tabs = TabsPrimitive.Root;
function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return <TabsPrimitive.List className={cn("flex gap-5 border-b border-border", className)} {...props} />;
}
function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return <TabsPrimitive.Tab className={cn("cursor-pointer appearance-none border-0 border-b-2 border-solid border-transparent bg-transparent px-1 py-3 text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring data-active:border-primary data-active:text-foreground data-active:font-medium", className)} {...props} />;
}
function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return <TabsPrimitive.Panel className={cn("min-w-0 outline-none", className)} {...props} />;
}
export { Tabs, TabsList, TabsTrigger, TabsContent };
