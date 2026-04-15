import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useCreateSupplier } from "@/hooks/useProductData";
import { Loader2 } from "lucide-react";
import { maskCnpj, maskPhone, maskCep } from "@/lib/masks";
import { fetchCep } from "@/lib/viacep";
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog";
import { useUnsavedChanges } from "@/hooks/useUnsavedChanges";

const schema = z.object({
  name: z.string().min(1, "Nome obrigatório").max(200),
  cnpj: z.string().max(20).optional().or(z.literal("")),
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  address: z.string().max(500).optional().or(z.literal("")),
  cep: z.string().max(10).optional().or(z.literal("")),
  city: z.string().max(100).optional().or(z.literal("")),
  state: z.string().max(2).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof schema>;

interface SupplierFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SupplierFormDialog({ open, onOpenChange }: SupplierFormDialogProps) {
  const createSupplier = useCreateSupplier();
  const [cepLoading, setCepLoading] = useState(false);
  const [cepError, setCepError] = useState(false);
  const [cepFilled, setCepFilled] = useState(false);

  const { guardedClose, showConfirm, confirmDiscard, confirmContinue, markDirty, resetDirty } = useUnsavedChanges(onOpenChange);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", cnpj: "", email: "", phone: "", address: "", cep: "", city: "", state: "" },
  });

  const handleCepLookup = async (cep: string) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setCepLoading(true);
    setCepError(false);
    const result = await fetchCep(digits);
    setCepLoading(false);
    if (result) {
      form.setValue("address", result.logradouro || "");
      form.setValue("city", result.localidade || "");
      form.setValue("state", result.uf || "");
      setCepFilled(true);
      setTimeout(() => setCepFilled(false), 1500);
    } else {
      setCepError(true);
    }
  };

  const onSubmit = async (values: FormValues) => {
    const fullAddress = [values.address, values.city, values.state].filter(Boolean).join(", ");
    await createSupplier.mutateAsync({
      name: values.name,
      cnpj: values.cnpj || undefined,
      email: values.email || undefined,
      phone: values.phone || undefined,
      address: fullAddress || undefined,
    });
    resetDirty();
    onOpenChange(false);
    form.reset();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={guardedClose}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" onChange={markDirty}>
              <FormField control={form.control} name="name" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl><Input {...field} placeholder="Nome do fornecedor" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="cnpj" render={({ field }) => (
                <FormItem>
                  <FormLabel>CNPJ</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value || ""}
                      onChange={(e) => field.onChange(maskCnpj(e.target.value))}
                      placeholder="00.000.000/0000-00"
                      maxLength={18}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl><Input {...field} type="email" placeholder="email@empresa.com" /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="phone" render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone</FormLabel>
                  <FormControl>
                    <Input
                      value={field.value || ""}
                      onChange={(e) => field.onChange(maskPhone(e.target.value))}
                      placeholder="(00) 00000-0000"
                      maxLength={15}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              {/* CEP with auto-lookup */}
              <FormField control={form.control} name="cep" render={({ field }) => (
                <FormItem>
                  <FormLabel>CEP</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        value={field.value || ""}
                        onChange={(e) => {
                          const masked = maskCep(e.target.value);
                          field.onChange(masked);
                          setCepError(false);
                          handleCepLookup(masked);
                        }}
                        placeholder="00000-000"
                        maxLength={9}
                        className={cepError ? "border-destructive" : ""}
                      />
                      {cepLoading && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-primary" />
                      )}
                    </div>
                  </FormControl>
                  {cepError && <p className="text-xs text-destructive">CEP não encontrado</p>}
                </FormItem>
              )} />

              <FormField control={form.control} name="address" render={({ field }) => (
                <FormItem>
                  <FormLabel>Endereço</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Endereço completo"
                      className={cepFilled ? "border-emerald-500 transition-colors" : "transition-colors"}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="city" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cidade</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="Cidade"
                        className={cepFilled ? "border-emerald-500 transition-colors" : "transition-colors"}
                      />
                    </FormControl>
                  </FormItem>
                )} />
                <FormField control={form.control} name="state" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Estado (UF)</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        placeholder="UF"
                        maxLength={2}
                        className={cepFilled ? "border-emerald-500 transition-colors" : "transition-colors"}
                      />
                    </FormControl>
                  </FormItem>
                )} />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => guardedClose(false)}>Cancelar</Button>
                <Button type="submit" disabled={createSupplier.isPending}>
                  {createSupplier.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Criar Fornecedor
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      <UnsavedChangesDialog open={showConfirm} onDiscard={confirmDiscard} onContinue={confirmContinue} />
    </>
  );
}
