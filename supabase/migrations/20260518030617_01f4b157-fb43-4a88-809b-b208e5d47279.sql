
-- ============ cab_questions ============
CREATE TABLE public.cab_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text text NOT NULL,
  example_text text,
  cab_level text NOT NULL CHECK (cab_level IN ('C1','C2','A1','A2','B1','B2')),
  weight numeric NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cab_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cab_questions_select_auth ON public.cab_questions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY cab_questions_admin_all ON public.cab_questions
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER cab_questions_touch BEFORE UPDATE ON public.cab_questions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ cab_level_definitions ============
CREATE TABLE public.cab_level_definitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cab_level text NOT NULL UNIQUE CHECK (cab_level IN ('C1','C2','A1','A2','B1','B2')),
  level_name text NOT NULL,
  description text NOT NULL,
  next_move text NOT NULL,
  recommended_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cab_level_definitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY cab_levels_select_auth ON public.cab_level_definitions
  FOR SELECT TO authenticated USING (true);
CREATE POLICY cab_levels_admin_all ON public.cab_level_definitions
  FOR ALL TO authenticated USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

CREATE TRIGGER cab_levels_touch BEFORE UPDATE ON public.cab_level_definitions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ============ cab_assessments ============
CREATE TABLE public.cab_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  final_level text NOT NULL CHECK (final_level IN ('C1','C2','A1','A2','B1','B2')),
  final_level_name text NOT NULL,
  level_scores jsonb NOT NULL DEFAULT '{}'::jsonb,
  selected_question_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cab_assessments ENABLE ROW LEVEL SECURITY;

CREATE INDEX cab_assessments_user_idx ON public.cab_assessments (user_id, created_at DESC);

CREATE POLICY cab_assessments_select_own_or_admin ON public.cab_assessments
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin(auth.uid()));
CREATE POLICY cab_assessments_insert_own ON public.cab_assessments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY cab_assessments_delete_admin ON public.cab_assessments
  FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- ============ Seed level definitions ============
INSERT INTO public.cab_level_definitions (cab_level, level_name, description, next_move, recommended_actions, sort_order) VALUES
('C1','Basic User','You use AI occasionally for one-off tasks like rewriting, summarizing, brainstorming, or asking simple questions.','Start using AI more consistently for repeat work.',
 '["Create 3 saved prompts for regular tasks","Use AI for daily writing and summarization","Start giving AI more context before asking for output"]'::jsonb,1),
('C2','Power User','You use AI regularly with reusable context, files, prompts, memory, or folders.','Move from prompting to simple automation.',
 '["Identify one repeated task","Connect AI to one other app","Create a simple workflow that reduces manual effort"]'::jsonb,2),
('A1','Automator','You have connected apps so AI can complete simple tasks without you manually doing every step.','Move from simple automation to workflow design.',
 '["Add conditions to an existing workflow","Add human review for risky outputs","Create a multi-step workflow across apps"]'::jsonb,3),
('A2','Workflow Designer','You design workflows where AI follows triggers, conditions, routing logic, and review rules.','Convert one workflow into a reusable tool.',
 '["Create a simple internal tool","Add a user interface to a workflow","Test failure cases and exception paths"]'::jsonb,4),
('B1','Tool Builder','You have built something others can open and use, such as an app, dashboard, form, landing page, or internal tool.','Move from prototype to reliable product.',
 '["Add authentication and permissions","Improve UX and error handling","Test the tool with real users"]'::jsonb,5),
('B2','Product Builder','You are building reliable AI-enabled systems for real users, with scale, security, testing, and maintenance in mind.','Improve adoption, measurement, and reliability.',
 '["Track usage analytics","Add monitoring and feedback loops","Improve security, reliability, and maintainability"]'::jsonb,6);

-- ============ Seed questions ============
INSERT INTO public.cab_questions (cab_level, sort_order, question_text) VALUES
('C1',1,'I use ChatGPT, Claude, Gemini, or Copilot occasionally when I remember to.'),
('C1',2,'I mostly use AI for simple writing, rewriting, summarizing, or brainstorming.'),
('C1',3,'I usually start a fresh chat every time I use AI.'),
('C1',4,'I rarely give AI detailed background context before asking for output.'),
('C2',5,'I use AI almost every working day.'),
('C2',6,'I use files, folders, projects, memory, saved prompts, or custom instructions.'),
('C2',7,'I reuse prompts or templates for regular work.'),
('C2',8,'I give AI background context before asking it to create output.'),
('C2',9,'I use AI to compare documents, prepare meeting notes, analyze content, or improve my work.'),
('A1',10,'I have connected AI with at least one other app.'),
('A1',11,'I use simple automations where AI helps complete a task without me doing every step manually.'),
('A1',12,'I have used tools like Zapier, Make, Pabbly, Google AI Studio, or similar platforms.'),
('A1',13,'I have created flows such as form response to email draft, email to summary, lead to CRM update, or document to notification.'),
('A2',14,'I have built multi-step workflows with triggers, conditions, and actions.'),
('A2',15,'My AI workflow can classify, route, escalate, summarize, draft, or decide the next step.'),
('A2',16,'Humans are involved only for review, approval, or exception handling.'),
('A2',17,'I have created workflows that connect multiple systems or apps.'),
('A2',18,'I actively think about failure points, review rules, and handoff logic in AI workflows.'),
('B1',19,'I have built a simple app, dashboard, form, landing page, agent, or internal tool using AI.'),
('B1',20,'Other people can open and use something I have created.'),
('B1',21,'I have used tools like Lovable, Replit, Bolt, Cursor, Vercel, Google AI Studio, or similar tools to build something.'),
('B1',22,'I have turned an idea into a working prototype using AI.'),
('B2',23,'I am building AI-enabled tools or systems for real users, not just myself.'),
('B2',24,'I think about reliability, security, permissions, data handling, testing, and scale.'),
('B2',25,'I maintain, improve, or debug tools after they are launched.'),
('B2',26,'I am building or managing a SaaS product, enterprise workflow, internal platform, or production-grade AI system.'),
('B2',27,'The tools I build need to work consistently for multiple users.');
