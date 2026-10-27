# Technician Training Environment

A browser-based simulator for building and practicing technician training recipes. It is an independent training tool; it does not connect to GPOMS MES, autoclaves, or any production environment.

## Run the website

Use the deployed GitHub Pages URL for training. To preview local changes, serve the project folder with a static web server; no installation or build step is required.

## Publish a public website

Before the first deployment, a repository administrator must open **Settings → Pages** and set **Build and deployment → Source** to **GitHub Actions**. The workflow then deploys the static site whenever changes are pushed to `main`. It publishes `index.html`, `styles.css`, `app.js`, and the shared `recipes.json` catalog. After a successful deployment, find the public URL in the workflow run or the repository's **Settings → Pages**. Anyone with the link can access the site.

GitHub Pages is public hosting for this project. Do not publish confidential procedures, sensitive information, or content that is not approved for public access.

## Published recipe library

The website is read-only for trainees. It loads the shared, published catalog from [`recipes.json`](./recipes.json); it does not offer a recipe editor or save recipes in a visitor's browser. Every visitor sees the same deployed recipes and areas. Select a recipe to open its left-to-right flowchart. It shows step labels and progress only, not prompt titles, instructions, or check routes. Trainees select the highlighted step, complete its prompt, and return to the flowchart to unlock the next step. On narrow screens, scroll horizontally to see the entire flow.

To add or update a recipe, edit `recipes.json` in the GitHub repository and push the change to `main`. GitHub Pages will deploy the updated shared library. Give write access to the repository only to the person authorized to publish recipes or application changes; everyone else can use the public website without a GitHub account. Check **Settings → Collaborators** and remove any write access that should not be there. Anyone may read the public repository, and users can make their own forks, but those changes do not change the official site.

Run the site through GitHub Pages or a local static web server; opening `index.html` directly as a `file:` URL does not support loading the shared JSON catalog.

## Recipe format

- Each recipe has a unique `id`, a `name`, an `area`, a short `description`, an estimated `duration`, and a `steps` array.
- Each step has a unique `id` within its recipe, a `type`, a `title`, and `instructions`. Its optional unique `label` is the identifier displayed in the flowchart. When omitted, the app generates a label based on its type (and recognizes equipment check-in titles).
- For an action step, the trainee selects **Complete step & return to flow** to mark the simulated prompt complete.
- **Acknowledge / sign** asks the trainee to enter their name before they can continue. The name is only held during that practice session.
- **Instruction / action** presents an instruction and requires the trainee to explicitly complete the prompt.
- **Yes / no check** requires the trainee to select an answer. Configure each answer to continue, go to another step, end the recipe as complete, or stop practice.
- For a check step, `yesNext` and `noNext` accept `next`, `complete`, `stop`, or the `id` of another step in the same recipe.

The sample recipe is set to stop practice if an alarm occurs or the air removal test fails; a no-alarm result and a passing test continue to the next step. These are sample training routes, not operational instructions. Change them only to match approved site training procedures.

For safety, use fictional or approved training content. This project is hosted publicly: recipe data, application code, and the website are accessible to anyone on the internet. Do not publish confidential procedures, sensitive information, or content that is not approved for public access. The simulator does not validate real equipment, determine operational decisions, create production records, or replace approved site procedures.
