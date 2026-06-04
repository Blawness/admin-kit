# @blawness/admin-kit

Reusable CMS core (auth, media, users, editor, admin shell, shared components)
extracted from the LIPAN RI site. Consumed as a private Git dependency.

## Consumer setup
1. `pnpm add github:Blawness/admin-kit#vX.Y.Z`
2. Add to `next.config`: `transpilePackages: ["@blawness/admin-kit"]`
3. Ensure Tailwind scans the package and defines the `navy`/`brand`/`gold` tokens.
