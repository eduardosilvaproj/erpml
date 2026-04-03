import { useCompanyMembers, useMyCompany } from "@/hooks/useCompanyData";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, Users, UserCheck, UserX } from "lucide-react";

const roleLabels: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
  owner: { label: "Proprietário", variant: "default" },
  manager: { label: "Gerente", variant: "secondary" },
  member: { label: "Membro", variant: "outline" },
};

export default function Equipe() {
  const { data: company, isLoading: loadingCompany } = useMyCompany();
  const { data: members, isLoading: loadingMembers } = useCompanyMembers(company?.id);

  const isLoading = loadingCompany || loadingMembers;

  const activeCount = members?.filter((m) => m.is_active).length || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Equipe</h1>
        <p className="text-muted-foreground">Membros da sua empresa</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Membros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{members?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Membros Ativos</CardTitle>
            <UserCheck className="h-4 w-4 text-accent" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe</CardTitle>
          <CardDescription>
            {company?.name ? `Equipe de ${company.name}` : "Carregando..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : !members?.length ? (
            <p className="text-muted-foreground text-center py-8">Nenhum membro encontrado.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {members.map((member) => {
                const initials = (member.profile?.full_name || "?")
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();
                const role = roleLabels[member.role] || { label: member.role, variant: "outline" as const };

                return (
                  <Card key={member.id} className="flex items-center gap-4 p-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={undefined} alt={member.profile?.full_name || ""} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {member.profile?.full_name || "Sem nome"}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant={role.variant}>{role.label}</Badge>
                        {member.is_active ? (
                          <Badge variant="outline" className="text-accent border-accent/30">
                            <UserCheck className="h-3 w-3 mr-1" /> Ativo
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            <UserX className="h-3 w-3 mr-1" /> Inativo
                          </Badge>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
