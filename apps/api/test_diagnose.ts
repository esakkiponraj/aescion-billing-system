import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== USERS IN DATABASE ===');
  const users = await prisma.user.findMany({
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

  for (const u of users) {
    console.log(`\nUser: ${u.firstName} ${u.lastName} (${u.email}) - SuperAdmin: ${u.isSuperAdmin}, Active: ${u.isActive}`);
    for (const m of u.memberships) {
      console.log(`  Org: ${m.organization.name} (${m.organization.id}) - Status: ${m.status}`);
      for (const mr of m.membershipRoles) {
        console.log(`    Org Role: ${mr.role.name} [${mr.role.code}] (perms: ${mr.role.rolePermissions.length})`);
        console.log(`      Perm codes: ${mr.role.rolePermissions.map((rp) => rp.permission.code).join(', ')}`);
      }
      for (const om of m.outletMemberships) {
        console.log(`    Outlet: ${om.outlet.name} (${om.outlet.id})`);
        for (const mr of om.membershipRoles) {
          console.log(`      Outlet Role: ${mr.role.name} [${mr.role.code}] (perms: ${mr.role.rolePermissions.length})`);
          console.log(`        Perm codes: ${mr.role.rolePermissions.map((rp) => rp.permission.code).join(', ')}`);
        }
      }
    }
  }

  console.log('\n=== ALL ROLES IN DATABASE ===');
  const roles = await prisma.role.findMany({
    include: {
      organization: true,
      rolePermissions: {
        include: {
          permission: true,
        },
      },
    },
  });
  for (const r of roles) {
    console.log(`Role: ${r.name} [${r.code}] (Org: ${r.organization?.name})`);
    console.log(`  Perms (${r.rolePermissions.length}): ${r.rolePermissions.map((rp) => rp.permission.code).join(', ')}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
