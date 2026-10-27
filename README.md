# Technician Training Environment

A browser-based simulator for building and practicing technician training recipes. It is an independent training tool; it does not connect to GPOMS MES, autoclaves, or any production environment.

## Run the website

Open `index.html` in a current desktop or mobile browser. No installation or build step is required.

## Publish a public website

The GitHub Actions workflow deploys the static site to GitHub Pages whenever changes are pushed to `main`. It publishes only `index.html`, `styles.css`, and `app.js`. After the first successful deployment, find the public URL in the workflow run or the repository's **Settings → Pages**. Anyone with the link can access the site.

GitHub Pages is public hosting for this project. Do not publish confidential procedures, sensitive information, or content that is not approved for public access. The recipe library is stored in each visitor's browser, so creating or editing a recipe does not share it with other users.

## Recipe library

- Start with the sample **Autoclave readiness check** recipe.
- Use **Create recipe** to write a recipe, choose an area, estimate its duration, and add steps.
- Add areas with the **+** button beside Areas. Recipes can be filtered by area and searched by name or description.
- Edit a recipe to reorder its steps by removing and re-adding them, and to update instructions or checks.
- Recipe data and areas are stored in this browser's local storage. They are not shared with other browsers or devices.

## Step types and check routes

- **Acknowledge / sign** asks the trainee to enter their name before they can continue. The name is only held during that practice session.
- **Instruction / action** presents an instruction and a Next step button.
- **Yes / no check** requires the trainee to select an answer. Configure each answer to continue, go to another step, end the recipe as complete, or stop practice.

The sample recipe is set to stop practice if an alarm occurs or the air removal test fails; a no-alarm result and a passing test continue to the next step. These are sample training routes, not operational instructions. Change them only to match approved site training procedures.

For safety, use fictional or approved training content. The simulator does not validate real equipment, determine operational decisions, create production records, or replace approved site procedures. All assets are served locally by the browser; the app makes no network requests.
