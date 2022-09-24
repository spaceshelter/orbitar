# Env files organization

### Structure

* `.env`
    
    The main env file, contains all variables used in production.  
    Not actually present in the codebase, could be created locally from `.env.sample`.
    A place to add dynamic (env-specific) variables, like API keys, etc. 

    Names of the new variables should be added to `.env.sample` 
    and passed to either frontend or backend via `docker-compose.yml`.
    This file is overridden in production environment.


* `.env.sample`

    An example (template) of main env file, not used in code.
    Add names of new variables here.


* `backend/.env`

    Env file specific for backend in production environment (see `backend/package.json`). 
    A place to add static things, like database name.


* `backend/.env.development`

    Env file specific for backend in development environment (see `backend/package.json`).
    Conceptually same as `backend/.env`, but used in node development environment.

    
* `frontend/.env`
    Env file specific for frontend in production environment (see `frontend/package.json`).
    A place to add static frontend-specific things, like API url.


* `frontend/.env.development`
   Same as `frontend/.env`, but used in node development environment.
   See `frontend/package.json`.

---

### Where to add things?

The rule of thumb is the following:

* Dynamic env-dependent things (i.e. stuff that will be overridden in prod, like API keys):
  * should be added to root .env file
  * should be passed to either frontend or backend in docker-compose.local.yml and docker-compose.ssl.local.yml
  * for development only, should be added to .env.development files in frontend and backend respectively

* Static things (database name, API url):
  * should be added to backend/.env or frontend/.env
  * and also to backend/.env.development or frontend/.env.development
