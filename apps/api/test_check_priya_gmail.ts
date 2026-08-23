import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const priya = await prisma.user.findFirst({
    where: { email: 'priya@gmail.com' },
    include: {
      memberships: {
        include: {
          organization: true,
          membershipRoles: {
            include: {
              role: {
                include: {
                  rolePermissions: {
                    include: {
                      permission: true,
                    },
                  },
                },
              },
            },
          },
          outletMemberships: {
            include: {
              outlet: true,
              membershipRoles: {
                include: {
                  role: {
                    include: {
                      rolePermissions: {
                        include: {
                          permission: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  console.log('User Priya:', priya?.email, 'Active:', priya?.isActive);
  if (priya) {
    for (const m of priya.memberships) {
      console.log(`Org: ${m.organization.name} (${m.organization.id})`);
      for (const mr of m.membershipRoles) {
        console.log(`  Org Role: ${mr.role.name} [${mr.role.code}] -> Perms count: ${mr.role.rolePermissions.length}`);
        console.log(`    ${mr.role.rolePermissions.map((rp) => rp.permission.code).join(', ')}`);
      }
      for (const om of m.outletMemberships) {
        console.log(`  Outlet: ${om.outlet.name} (${om.outlet.id})`);
        for (const mr of om.membershipRoles) {
          console.log(`    Outlet Role: ${mr.role.name} [${mr.role.code}] -> Perms count: ${mr.role.rolePermissions.length}`);
          console.log(`      ${mr.role.rolePermissions.map((rp) => rp.permission.code).join(', ')}`);
        }
      }
    }
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
