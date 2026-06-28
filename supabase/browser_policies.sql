drop policy if exists "browser read projects" on public.projects;
create policy "browser read projects"
on public.projects
for select
to anon
using (true);

drop policy if exists "browser read clients" on public.client_brains;
create policy "browser read clients"
on public.client_brains
for select
to anon
using (true);

drop policy if exists "browser read tasks" on public.task_queue;
create policy "browser read tasks"
on public.task_queue
for select
to anon
using (true);

drop policy if exists "browser read events" on public.event_stream;
create policy "browser read events"
on public.event_stream
for select
to anon
using (true);
